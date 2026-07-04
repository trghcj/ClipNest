from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
import os
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User

security = HTTPBearer()

# We will initialize the firebase admin app in main.py
# using the service account credentials

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "no-email@clipnest.app")
        
        # Check if user exists in db
        stmt = select(User).where(User.id == uid)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            new_user = User(id=uid, email=email)
            db.add(new_user)
            await db.commit()
            
        return uid
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
