from sqlalchemy.orm import Session
from ..models.activity import ActivityLog
import uuid

def log_activity(db: Session, user_id: str, action_type: str, target_id: str = None):
    activity = ActivityLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action_type=action_type,
        target_id=target_id
    )
    db.add(activity)
    # Don't commit here, let the calling endpoint commit so it's part of the same transaction
