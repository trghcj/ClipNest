from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ActivityLogBase(BaseModel):
    action_type: str
    target_id: Optional[str] = None

class ActivityLogResponse(ActivityLogBase):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True
