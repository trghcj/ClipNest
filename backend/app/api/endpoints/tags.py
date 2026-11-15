from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.bookmark import Bookmark
from ...models.tag import BookmarkTag, Tag
from ...schemas.tag import TagCreate, TagResponse

router = APIRouter()


async def _assert_owns_tag(db: AsyncSession, tag_id: str, user_id: str) -> Tag:
    tag = (await db.execute(select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id))).scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


async def _assert_owns_bookmark(db: AsyncSession, bookmark_id: str, user_id: str) -> None:
    owned = await db.execute(select(Bookmark.id).where(Bookmark.id == bookmark_id, Bookmark.user_id == user_id))
    if not owned.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Bookmark not found")


@router.post("/", response_model=TagResponse)
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    name = tag.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Tag name cannot be empty")
    # Tag names are matched case-insensitively so "Python" and "python" don't become two tags.
    existing = (await db.execute(
        select(Tag).where(func.lower(Tag.name) == name.lower(), Tag.user_id == current_user).limit(1)
    )).scalars().first()
    if existing:
        return existing

    db_tag = Tag(user_id=current_user, name=name, is_ai_generated=tag.is_ai_generated)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag


@router.get("/", response_model=List[TagResponse])
async def read_tags(db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Tag).where(Tag.user_id == current_user).order_by(Tag.name)
    return (await db.execute(stmt)).scalars().all()


@router.delete("/{tag_id}")
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    tag = await _assert_owns_tag(db, tag_id, current_user)
    await db.delete(tag)
    await db.commit()
    return {"ok": True}


@router.post("/{tag_id}/bookmarks/{bookmark_id}")
async def add_tag_to_bookmark(tag_id: str, bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    await _assert_owns_tag(db, tag_id, current_user)
    await _assert_owns_bookmark(db, bookmark_id, current_user)
    db.add(BookmarkTag(bookmark_id=bookmark_id, tag_id=tag_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already tagged: treat as success
    return {"ok": True}


@router.delete("/{tag_id}/bookmarks/{bookmark_id}")
async def remove_tag_from_bookmark(tag_id: str, bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    await _assert_owns_tag(db, tag_id, current_user)
    await _assert_owns_bookmark(db, bookmark_id, current_user)
    await db.execute(delete(BookmarkTag).where(BookmarkTag.bookmark_id == bookmark_id, BookmarkTag.tag_id == tag_id))
    await db.commit()
    return {"ok": True}
