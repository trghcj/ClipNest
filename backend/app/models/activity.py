from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from app.core.database import Base

class Pdf(Base):
    __tablename__ = "clipnest_pdfs"

    id = Column(String, primary_key=True, index=True)
    bookmark_id = Column(String, ForeignKey("clipnest_bookmarks.id", ondelete="CASCADE"), nullable=False, unique=True)
    file_path = Column(String, nullable=False)
    file_size_bytes = Column(Integer)
    page_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ActivityLog(Base):
    __tablename__ = "clipnest_activity_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("clipnest_users.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String, nullable=False) # e.g., "read", "favorite", "archive", "search"
    target_id = Column(String) # e.g., bookmark_id
    created_at = Column(DateTime(timezone=True), server_default=func.now())
