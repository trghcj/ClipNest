from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.bookmark import Bookmark
from ...models.collection import Collection, CollectionBookmark
from ...schemas.bookmark import BookmarkListItem
from ...schemas.collection import CollectionCreate, CollectionResponse, CollectionUpdate
from .bookmarks import LIST_OPTIONS

router = APIRouter()


async def _get_owned_collection(db: AsyncSession, collection_id: str, user_id: str) -> Collection:
    result = await db.execute(select(Collection).where(Collection.id == collection_id, Collection.user_id == user_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


@router.post("/", response_model=CollectionResponse)
async def create_collection(collection: CollectionCreate, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_collection = Collection(user_id=current_user, name=collection.name, description=collection.description)
    db.add(db_collection)
    await db.commit()
    await db.refresh(db_collection)
    return db_collection


@router.get("/", response_model=List[CollectionResponse])
async def read_collections(db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Collection).where(Collection.user_id == current_user).order_by(Collection.created_at)
    return (await db.execute(stmt)).scalars().all()


@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_collection(collection_id: str, updates: CollectionUpdate, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    collection = await _get_owned_collection(db, collection_id, current_user)
    if updates.name is not None:
        collection.name = updates.name
    if updates.description is not None:
        collection.description = updates.description
    await db.commit()
    await db.refresh(collection)
    return collection


@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    collection = await _get_owned_collection(db, collection_id, current_user)
    await db.delete(collection)
    await db.commit()
    return {"ok": True}


@router.post("/{collection_id}/bookmarks/{bookmark_id}")
async def add_bookmark_to_collection(collection_id: str, bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    await _get_owned_collection(db, collection_id, current_user)
    owned = await db.execute(select(Bookmark.id).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user))
    if not owned.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Bookmark not found")

    db.add(CollectionBookmark(collection_id=collection_id, bookmark_id=bookmark_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already in this collection: treat as success
    return {"ok": True}


@router.delete("/{collection_id}/bookmarks/{bookmark_id}")
async def remove_bookmark_from_collection(collection_id: str, bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    await _get_owned_collection(db, collection_id, current_user)
    await db.execute(delete(CollectionBookmark).where(
        CollectionBookmark.collection_id == collection_id, CollectionBookmark.bookmark_id == bookmark_id
    ))
    await db.commit()
    return {"ok": True}


@router.get("/{collection_id}/bookmarks", response_model=List[BookmarkListItem])
async def read_collection_bookmarks(collection_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    await _get_owned_collection(db, collection_id, current_user)
    stmt = (
        select(Bookmark).options(*LIST_OPTIONS)
        .join(CollectionBookmark, Bookmark.id == CollectionBookmark.bookmark_id)
        .where(CollectionBookmark.collection_id == collection_id, Bookmark.user_id == current_user)
        .order_by(Bookmark.created_at.desc(), Bookmark.id)
    )
    return (await db.execute(stmt)).scalars().all()
