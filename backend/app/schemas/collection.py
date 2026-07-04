from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .bookmark import BookmarkResponse

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CollectionResponse(CollectionBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CollectionWithBookmarksResponse(CollectionResponse):
    bookmarks: List[BookmarkResponse] = []
