from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from typing import List
from ...core.database import get_db
from ...models.tag import Tag, BookmarkTag
from ...models.bookmark import Bookmark
from ...schemas.tag import TagCreate, TagResponse
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=TagResponse)
async def create_tag(tag: TagCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Check if tag already exists for user
    stmt = select(Tag).where(Tag.name == tag.name, Tag.user_id == current_user)
    result = await db.execute(stmt)
    existing_tag = result.scalar_one_or_none()
    if existing_tag:
        return existing_tag

    db_tag = Tag(
        user_id=current_user,
        name=tag.name,
        is_ai_generated=tag.is_ai_generated
    )
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag

@router.get("/", response_model=List[TagResponse])
async def read_tags(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Tag).where(Tag.user_id == current_user)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/{tag_id}")
async def delete_tag(tag_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()
    
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
        
    await db.delete(tag)
    await db.commit()
    return {"ok": True}

@router.post("/{tag_id}/bookmarks/{bookmark_id}")
async def add_tag_to_bookmark(tag_id: str, bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify tag exists and belongs to user
    tag_stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user)
    tag_result = await db.execute(tag_stmt)
    if not tag_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tag not found")
        
    # Verify bookmark exists and belongs to user
    bm_stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    bm_result = await db.execute(bm_stmt)
    if not bm_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    # Add mapping
    try:
        db_bm_tag = BookmarkTag(bookmark_id=bookmark_id, tag_id=tag_id)
        db.add(db_bm_tag)
        await db.commit()
    except Exception:
        await db.rollback()
        pass
        
    return {"ok": True}

@router.delete("/{tag_id}/bookmarks/{bookmark_id}")
async def remove_tag_from_bookmark(tag_id: str, bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify tag belongs to user
    tag_stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user)
    tag_result = await db.execute(tag_stmt)
    if not tag_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tag not found")
        
    stmt = delete(BookmarkTag).where(BookmarkTag.bookmark_id == bookmark_id, BookmarkTag.tag_id == tag_id)
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}
