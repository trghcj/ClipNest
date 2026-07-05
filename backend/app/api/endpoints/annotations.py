from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.annotation import Annotation
from app.models.bookmark import Bookmark
from app.schemas.annotation import AnnotationCreate, AnnotationResponse, ExtensionAnnotationCreate

router = APIRouter()

@router.post("/bookmarks/{bookmark_id}/annotations", response_model=AnnotationResponse)
async def create_annotation(
    bookmark_id: str,
    annotation: AnnotationCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    # Check if bookmark exists and belongs to user
    stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    bookmark = db.execute(stmt).scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    db_annotation = Annotation(
        bookmark_id=bookmark_id,
        user_id=current_user,
        highlight_text=annotation.highlight_text,
        note_text=annotation.note_text
    )
    db.add(db_annotation)
    db.commit()
    db.refresh(db_annotation)
    return db_annotation

@router.get("/bookmarks/{bookmark_id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(
    bookmark_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    stmt = select(Annotation).where(Annotation.bookmark_id == bookmark_id, Annotation.user_id == current_user)
    annotations = db.execute(stmt).scalars().all()
    return annotations

@router.delete("/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    stmt = select(Annotation).where(Annotation.id == annotation_id, Annotation.user_id == current_user)
    annotation = db.execute(stmt).scalar_one_or_none()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
        
    db.delete(annotation)
    db.commit()
    return {"status": "success"}

@router.post("/extension/annotations", response_model=AnnotationResponse)
async def create_extension_annotation(
    annotation: ExtensionAnnotationCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    # This endpoint is specifically for the Chrome Extension.
    # It tries to find a bookmark with the exact URL, and if it doesn't exist, it creates a silent bookmark.
    url_str = str(annotation.url)
    stmt = select(Bookmark).where(Bookmark.url == url_str, Bookmark.user_id == current_user)
    bookmark = db.execute(stmt).scalar_one_or_none()

    if not bookmark:
        # Create a silent bookmark
        bookmark = Bookmark(
            user_id=current_user,
            url=url_str,
            title=url_str, # Default title
            status="unread"
        )
        db.add(bookmark)
        db.flush() # Flush to get bookmark.id for the annotation

    db_annotation = Annotation(
        bookmark_id=bookmark.id,
        user_id=current_user,
        highlight_text=annotation.highlight_text,
        note_text=annotation.note_text
    )
    db.add(db_annotation)
    db.commit()
    db.refresh(db_annotation)
    return db_annotation
