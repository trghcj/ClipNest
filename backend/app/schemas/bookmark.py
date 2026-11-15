from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional, List
from datetime import datetime
from .tag import TagResponse
from .note import NoteResponse

BookmarkStatus = Literal["unread", "reading", "completed"]


class BookmarkCreate(BaseModel):
    # Title/description/images are extracted server-side from the URL; values sent by the
    # client are only used as fallbacks. Page `content` is never accepted from the client
    # (it is rendered as HTML in the reader).
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    favicon_url: Optional[str] = None
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False


class BookmarkUpdate(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    favicon_url: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    status: Optional[BookmarkStatus] = None
    tags: Optional[List[str]] = None


class BookmarkListItem(BaseModel):
    """Everything a card needs — without the (potentially huge) extracted page content."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    favicon_url: Optional[str] = None
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False
    status: Optional[str] = "unread"
    summary: Optional[str] = None
    content_length: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    tags: List[TagResponse] = []


class BookmarkCreateResult(BookmarkListItem):
    """Result of saving a URL; ``already_saved`` is true when the URL was already in the library
    (the existing bookmark is returned instead of creating a duplicate)."""
    already_saved: bool = False


class AIRefreshResult(BaseModel):
    queued: int
    remaining: int = 0


class BookmarkResponse(BookmarkListItem):
    """A single bookmark including its extracted content and note (used by the reader)."""
    content: Optional[str] = None
    note: Optional[NoteResponse] = None


class URLMetadataRequest(BaseModel):
    url: str


class URLMetadataResponse(BaseModel):
    title: str
    description: str
    image_url: str
    favicon_url: str


class AISearchRequest(BaseModel):
    query: str


class AISearchResponse(BaseModel):
    matching_ids: List[str]
