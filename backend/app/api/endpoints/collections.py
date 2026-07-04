from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from typing import List
from ...core.database import get_db
from ...models.collection import Collection, CollectionBookmark
from ...models.bookmark import Bookmark
from ...schemas.collection import CollectionCreate, CollectionResponse
from ...schemas.bookmark import BookmarkResponse
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=CollectionResponse)
async def create_collection(collection: CollectionCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_collection = Collection(
        user_id=current_user,
        name=collection.name,
        description=collection.description,
    )
    db.add(db_collection)
    await db.commit()
    await db.refresh(db_collection)
    return db_collection

@router.get("/", response_model=List[CollectionResponse])
async def read_collections(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Collection).where(Collection.user_id == current_user)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Collection).where(Collection.id == collection_id, Collection.user_id == current_user)
    result = await db.execute(stmt)
    collection = result.scalar_one_or_none()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    await db.delete(collection)
    await db.commit()
    return {"ok": True}

@router.post("/{collection_id}/bookmarks/{bookmark_id}")
async def add_bookmark_to_collection(collection_id: str, bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify collection exists and belongs to user
    col_stmt = select(Collection).where(Collection.id == collection_id, Collection.user_id == current_user)
    col_result = await db.execute(col_stmt)
    if not col_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection not found")
        
    # Verify bookmark exists and belongs to user
    bm_stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    bm_result = await db.execute(bm_stmt)
    if not bm_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    # Add mapping
    try:
        db_col_bm = CollectionBookmark(collection_id=collection_id, bookmark_id=bookmark_id)
        db.add(db_col_bm)
        await db.commit()
    except Exception:
        # Ignore if already exists (constraint violation)
        await db.rollback()
        pass
        
    return {"ok": True}

@router.delete("/{collection_id}/bookmarks/{bookmark_id}")
async def remove_bookmark_from_collection(collection_id: str, bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify collection belongs to user
    col_stmt = select(Collection).where(Collection.id == collection_id, Collection.user_id == current_user)
    col_result = await db.execute(col_stmt)
    if not col_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection not found")
        
    stmt = delete(CollectionBookmark).where(CollectionBookmark.collection_id == collection_id, CollectionBookmark.bookmark_id == bookmark_id)
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}

@router.get("/{collection_id}/bookmarks", response_model=List[BookmarkResponse])
async def read_collection_bookmarks(collection_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify collection belongs to user
    col_stmt = select(Collection).where(Collection.id == collection_id, Collection.user_id == current_user)
    col_result = await db.execute(col_stmt)
    if not col_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection not found")
        
    # Get bookmarks via join
    stmt = select(Bookmark).join(CollectionBookmark, Bookmark.id == CollectionBookmark.bookmark_id).where(CollectionBookmark.collection_id == collection_id)
    result = await db.execute(stmt)
    return result.scalars().all()
