from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from ...core.database import get_db
from ...models.bookmark import Bookmark
from ...schemas.bookmark import BookmarkCreate, BookmarkUpdate, BookmarkResponse, URLMetadataRequest, URLMetadataResponse
from ...services.metadata_extractor import extract_metadata
from ...services.background_tasks import process_bookmark_ai
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/extract-metadata", response_model=URLMetadataResponse)
async def get_metadata(request: URLMetadataRequest, current_user: str = Depends(get_current_user)):
    # Convert HttpUrl to string
    url_str = str(request.url)
    data = await extract_metadata(url_str)
    return data

@router.post("/", response_model=BookmarkResponse)
async def create_bookmark(bookmark: BookmarkCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_bookmark = Bookmark(
        user_id=current_user,
        url=str(bookmark.url),
        title=bookmark.title,
        description=bookmark.description,
        thumbnail_url=bookmark.thumbnail_url,
        favicon_url=bookmark.favicon_url,
        is_favorite=bookmark.is_favorite,
        is_archived=bookmark.is_archived,
        summary=bookmark.ai_summary
    )
    db.add(db_bookmark)
    await db.commit()
    await db.refresh(db_bookmark)
    
    # Spawn AI tagging and summarization in background
    background_tasks.add_task(process_bookmark_ai, db_bookmark.id, db_bookmark.url, db_bookmark.title or "", db_bookmark.description or "")
    
    return db_bookmark

@router.get("/", response_model=List[BookmarkResponse])
async def read_bookmarks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.user_id == current_user).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    result = await db.execute(stmt)
    bookmark = result.scalar_one_or_none()
    
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    await db.delete(bookmark)
    await db.commit()
    return {"ok": True}

@router.put("/{bookmark_id}", response_model=BookmarkResponse)
async def update_bookmark(bookmark_id: str, bookmark_update: BookmarkUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    result = await db.execute(stmt)
    bookmark = result.scalar_one_or_none()
    
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    update_data = bookmark_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(bookmark, key):
            if key == 'url' and value is not None:
                setattr(bookmark, key, str(value))
            else:
                setattr(bookmark, key, value)
            
    await db.commit()
    await db.refresh(bookmark)
    return bookmark

