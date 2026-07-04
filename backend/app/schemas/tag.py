from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TagBase(BaseModel):
    name: str
    is_ai_generated: Optional[bool] = False

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True
