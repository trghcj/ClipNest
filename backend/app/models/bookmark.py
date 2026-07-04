from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
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
    
    tags = relationship("Tag", secondary="clipnest_bookmark_tags", lazy="selectin")
