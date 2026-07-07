from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from ...core.database import get_db
from ...models.activity import ActivityLog
from ...schemas.activity import ActivityLogResponse
from ...core.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[ActivityLogResponse])
async def get_recent_activities(limit: int = 50, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(ActivityLog).where(ActivityLog.user_id == current_user).order_by(ActivityLog.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    activities = result.scalars().all()
    return activities
