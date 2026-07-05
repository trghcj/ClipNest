from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Annotation(Base):
    __tablename__ = "clipnest_annotations"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    bookmark_id = Column(String, ForeignKey("clipnest_bookmarks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("clipnest_users.id", ondelete="CASCADE"), nullable=False)
    highlight_text = Column(String, nullable=False)
    note_text = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
