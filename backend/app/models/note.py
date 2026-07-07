from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Note(Base):
    __tablename__ = "clipnest_notes"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    bookmark_id = Column(String, ForeignKey("clipnest_bookmarks.id", ondelete="CASCADE"), nullable=False, unique=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
