from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, text, cast, Date
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.bookmark import Bookmark
from app.models.tag import Tag, BookmarkTag
from pydantic import BaseModel

router = APIRouter()

class AnalyticsData(BaseModel):
    total_bookmarks: int
    read_bookmarks: int
    unread_bookmarks: int
    bookmarks_last_30_days: List[Dict[str, Any]]
    top_tags: List[Dict[str, Any]]

@router.get("/", response_model=AnalyticsData)
async def get_analytics(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # 1. Basic counts
    stmt_total = select(func.count(Bookmark.id)).where(Bookmark.user_id == current_user)
    result_total = await db.execute(stmt_total)
    total = result_total.scalar() or 0

    stmt_unread = select(func.count(Bookmark.id)).where(Bookmark.user_id == current_user, Bookmark.is_archived == False)
    result_unread = await db.execute(stmt_unread)
    unread = result_unread.scalar() or 0
    read = total - unread

    # 2. Bookmarks added per day for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # We will use SQLAlchemy to group by date
    stmt_history = select(
        cast(Bookmark.created_at, Date).label("date"),
        func.count(Bookmark.id).label("count")
    ).where(
        Bookmark.user_id == current_user,
        Bookmark.created_at >= thirty_days_ago
    ).group_by(
        cast(Bookmark.created_at, Date)
    ).order_by(
        cast(Bookmark.created_at, Date)
    )

    history_result_exec = await db.execute(stmt_history)
    history_result = history_result_exec.all()
    
    # Fill in missing days
    history_dict = {row.date.strftime("%Y-%m-%d"): row.count for row in history_result}
    history_list = []
    for i in range(30):
        day = (thirty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        history_list.append({
            "date": day,
            "count": history_dict.get(day, 0)
        })

    # 3. Top tags
    # Join BookmarkTag -> Bookmark to filter by user_id
    stmt_tags = select(
        Tag.name,
        func.count(BookmarkTag.bookmark_id).label("count")
    ).join(
        BookmarkTag, Tag.id == BookmarkTag.tag_id
    ).join(
        Bookmark, Bookmark.id == BookmarkTag.bookmark_id
    ).where(
        Bookmark.user_id == current_user
    ).group_by(
        Tag.name
    ).order_by(
        desc("count")
    ).limit(5)

    tags_result_exec = await db.execute(stmt_tags)
    tags_result = tags_result_exec.all()
    top_tags = [{"name": row.name, "count": row.count} for row in tags_result]

    return AnalyticsData(
        total_bookmarks=total,
        read_bookmarks=read,
        unread_bookmarks=unread,
        bookmarks_last_30_days=history_list,
        top_tags=top_tags
    )
