from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime
from .tag import TagResponse
from .note import NoteResponse

class BookmarkBase(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    favicon_url: Optional[str] = None
    content_type: Optional[str] = "article"
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False
    ai_summary: Optional[str] = None
    content: Optional[str] = None

class BookmarkCreate(BookmarkBase):
    pass

class BookmarkUpdate(BookmarkBase):
    url: Optional[str] = None
    tags: Optional[List[str]] = None

class BookmarkResponse(BookmarkBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    tags: List[TagResponse] = []
    note: Optional[NoteResponse] = None

    class Config:
        from_attributes = True

class URLMetadataRequest(BaseModel):
    url: str

class URLMetadataResponse(BaseModel):
    title: str
    description: str
    image_url: str
    favicon_url: str
    content: Optional[str] = None

class AISearchRequest(BaseModel):
    query: str

class AISearchResponse(BaseModel):
    matching_ids: List[str]
