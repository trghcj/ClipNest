from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Collection(Base):
    __tablename__ = "clipnest_collections"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("clipnest_users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class CollectionBookmark(Base):
    __tablename__ = "clipnest_collection_bookmarks"

    collection_id = Column(String, ForeignKey("clipnest_collections.id", ondelete="CASCADE"), primary_key=True)
    bookmark_id = Column(String, ForeignKey("clipnest_bookmarks.id", ondelete="CASCADE"), primary_key=True)
