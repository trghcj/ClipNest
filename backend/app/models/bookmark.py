from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Index, func as sa_func
from sqlalchemy.orm import relationship, column_property
from sqlalchemy.sql import func
from app.core.database import Base

import uuid

class Bookmark(Base):
    __tablename__ = "clipnest_bookmarks"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("clipnest_users.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    title = Column(String)
    description = Column(String)
    thumbnail_url = Column(String)
    favicon_url = Column(String)
    status = Column(String, default="unread") # unread, reading, completed
    summary = Column(String) # AI generated summary
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_favorite = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    content = Column(String) # Extracted text
    # Size of `content`, computed in SQL so list endpoints can estimate reading time
    # without sending the full content (octet_length avoids de-toasting large values).
    content_length = column_property(sa_func.coalesce(sa_func.octet_length(content), 0))
    
    tags = relationship("Tag", secondary="clipnest_bookmark_tags", lazy="selectin")
    note = relationship("Note", uselist=False, backref="bookmark", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("ix_clipnest_bookmarks_user_created", "user_id", "created_at"),
        Index("ix_clipnest_bookmarks_user_url", "user_id", "url"),
    )
