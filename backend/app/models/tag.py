from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

import uuid

class Tag(Base):
    __tablename__ = "clipnest_tags"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("clipnest_users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BookmarkTag(Base):
    __tablename__ = "clipnest_bookmark_tags"

    bookmark_id = Column(String, ForeignKey("clipnest_bookmarks.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(String, ForeignKey("clipnest_tags.id", ondelete="CASCADE"), primary_key=True)
