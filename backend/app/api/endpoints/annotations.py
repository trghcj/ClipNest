import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.annotation import Annotation
from app.models.bookmark import Bookmark
from app.schemas.annotation import AnnotationCreate, AnnotationResponse, ExtensionAnnotationCreate
from app.services.background_tasks import process_bookmark_ai
from app.services.metadata_extractor import extract_metadata

router = APIRouter()


@router.post("/bookmarks/{bookmark_id}/annotations", response_model=AnnotationResponse)
async def create_annotation(
    bookmark_id: str,
    annotation: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    owned = await db.execute(select(Bookmark.id).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user))
    if not owned.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Bookmark not found")

    db_annotation = Annotation(
        bookmark_id=bookmark_id,
        user_id=current_user,
        highlight_text=annotation.highlight_text,
        note_text=annotation.note_text,
    )
    db.add(db_annotation)
    await db.commit()
    await db.refresh(db_annotation)
    return db_annotation


@router.get("/bookmarks/{bookmark_id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(
    bookmark_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    stmt = (
        select(Annotation)
        .where(Annotation.bookmark_id == bookmark_id, Annotation.user_id == current_user)
        .order_by(Annotation.created_at)
    )
    return (await db.execute(stmt)).scalars().all()


@router.delete("/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    stmt = select(Annotation).where(Annotation.id == annotation_id, Annotation.user_id == current_user)
    annotation = (await db.execute(stmt)).scalar_one_or_none()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    await db.delete(annotation)
    await db.commit()
    return {"status": "success"}


@router.post("/extension/annotations", response_model=AnnotationResponse)
async def create_extension_annotation(
    annotation: ExtensionAnnotationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # Used by the Chrome extension: attach the highlight to the bookmark for this URL,
    # creating that bookmark silently if the user hasn't saved the page yet.
    url_str = str(annotation.url)
    stmt = select(Bookmark).where(Bookmark.url == url_str, Bookmark.user_id == current_user).limit(1)
    bookmark = (await db.execute(stmt)).scalars().first()

    if not bookmark:
        metadata = await extract_metadata(url_str)
        bookmark = Bookmark(
            id=str(uuid.uuid4()),
            user_id=current_user,
            url=url_str,
            title=metadata.get("title") or url_str,
            description=metadata.get("description"),
            thumbnail_url=metadata.get("image_url"),
            favicon_url=metadata.get("favicon_url"),
            content=metadata.get("content") or None,
            status="unread",
        )
        db.add(bookmark)
        await db.flush()  # insert the bookmark before the annotation that references it
        # Summary/tags are generated after the response, once the bookmark is committed.
        background_tasks.add_task(process_bookmark_ai, bookmark.id, url_str, bookmark.title or "", bookmark.description or "", bookmark.content)

    db_annotation = Annotation(
        bookmark_id=bookmark.id,
        user_id=current_user,
        highlight_text=annotation.highlight_text,
        note_text=annotation.note_text,
    )
    db.add(db_annotation)
    await db.commit()
    await db.refresh(db_annotation)
    return db_annotation
