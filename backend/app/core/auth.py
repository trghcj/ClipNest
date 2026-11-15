import asyncio
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
security = HTTPBearer()

# UIDs already known to exist in the DB. Users are only ever created, never
# deleted by the app, so this lets us skip a SELECT on every request.
_known_user_ids: set[str] = set()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    # Token verification may fetch Google's public keys over HTTP; keep it off the event loop.
    try:
        decoded_token = await asyncio.to_thread(auth.verify_id_token, credentials.credentials)
    except Exception as e:
        logger.info("Auth token rejected: %s", e)
        raise _unauthorized()

    uid = decoded_token["uid"]
    if uid in _known_user_ids:
        return uid

    # DB errors here are server errors (500), not authentication failures.
    result = await db.execute(select(User.id).where(User.id == uid))
    if result.scalar_one_or_none() is None:
        db.add(User(id=uid, email=decoded_token.get("email") or f"{uid}@users.clipnest.app"))
        try:
            await db.commit()
        except IntegrityError:
            # Two first requests raced to create the same user; the other one won.
            await db.rollback()
    _known_user_ids.add(uid)
    return uid
