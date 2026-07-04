from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime

class BookmarkBase(BaseModel):
    url: HttpUrl
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    favicon_url: Optional[str] = None
    content_type: Optional[str] = "article"
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False
    ai_summary: Optional[str] = None

class BookmarkCreate(BookmarkBase):
    pass

class BookmarkUpdate(BookmarkBase):
    url: Optional[HttpUrl] = None

class BookmarkResponse(BookmarkBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class URLMetadataRequest(BaseModel):
    url: HttpUrl

class URLMetadataResponse(BaseModel):
    title: str
    description: str
    image_url: str
    favicon_url: str
