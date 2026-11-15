import json
import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer, noload

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.bookmark import Bookmark
from ...models.note import Note
from ...models.tag import Tag
from ...schemas.bookmark import (
    AISearchRequest, AISearchResponse, BookmarkCreate, BookmarkListItem, BookmarkResponse,
    BookmarkUpdate, URLMetadataRequest, URLMetadataResponse,
)
from ...schemas.note import NoteResponse, NoteUpdate
from ...services.activity_service import log_activity
from ...services.ai_service import perform_semantic_search
from ...services.background_tasks import process_bookmark_ai
from ...services.metadata_extractor import extract_metadata
from ...services.pdf_extractor import MAX_UPLOAD_PDF_SIZE, extract_local_pdf
from ...services.search import full_text_matches
from ...services.url_utils import UnsafeURLError, assert_allowed_external_url

router = APIRouter()

# List views never need the extracted page content or the note.
LIST_OPTIONS = (defer(Bookmark.content), noload(Bookmark.note))
MAX_PAGE_SIZE = 500
# AI search sends Gemini at most this many candidates: full-text matches first, then the
# most recent bookmarks (so purely semantic queries still have something to rank).
AI_SEARCH_CANDIDATES = 150
AI_SEARCH_FULL_TEXT_LIMIT = 100


async def _get_owned_bookmark(db: AsyncSession, bookmark_id: str, user_id: str) -> Bookmark:
    result = await db.execute(select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == user_id))
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return bookmark


@router.post("/extract-metadata", response_model=URLMetadataResponse)
async def get_metadata(request: URLMetadataRequest, current_user: str = Depends(get_current_user)):
    try:
        safe_url = await assert_allowed_external_url(request.url)
    except UnsafeURLError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await extract_metadata(safe_url)


@router.post("", response_model=BookmarkListItem)
async def create_bookmark(bookmark: BookmarkCreate, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Extract on the server: the page is fetched once and its content never round-trips
    # through (or can be forged by) the browser.
    try:
        safe_url = await assert_allowed_external_url(bookmark.url)
    except UnsafeURLError as e:
        raise HTTPException(status_code=400, detail=str(e))
    metadata = await extract_metadata(safe_url)
    db_bookmark = Bookmark(
        id=str(uuid.uuid4()),  # set now so the activity log below can reference it
        user_id=current_user,
        url=bookmark.url,
        title=metadata.get("title") or bookmark.title or bookmark.url,
        description=metadata.get("description") or bookmark.description,
        thumbnail_url=metadata.get("image_url") or bookmark.thumbnail_url,
        favicon_url=metadata.get("favicon_url") or bookmark.favicon_url,
        is_favorite=bookmark.is_favorite,
        is_archived=bookmark.is_archived,
        content=metadata.get("content") or None,
    )
    db.add(db_bookmark)
    log_activity(db, current_user, "saved", db_bookmark.id)
    await db.commit()
    await db.refresh(db_bookmark)

    background_tasks.add_task(process_bookmark_ai, db_bookmark.id, db_bookmark.url, db_bookmark.title or "", db_bookmark.description or "", db_bookmark.content)
    return db_bookmark


@router.post("/pdf", response_model=BookmarkListItem)
async def upload_pdf_bookmark(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read at most one byte past the limit so an oversized upload can't exhaust memory.
    pdf_bytes = await file.read(MAX_UPLOAD_PDF_SIZE + 1)
    if len(pdf_bytes) > MAX_UPLOAD_PDF_SIZE:
        raise HTTPException(status_code=413, detail=f"PDF is larger than {MAX_UPLOAD_PDF_SIZE // (1024 * 1024)} MB")

    metadata = await extract_local_pdf(pdf_bytes, file.filename)
    db_bookmark = Bookmark(
        id=str(uuid.uuid4()),
        user_id=current_user,
        url=f"local://{uuid.uuid4()}/{file.filename}",  # placeholder URL for an uploaded file
        title=metadata.get("title") or file.filename,
        description=metadata.get("description", "Uploaded PDF Document"),
        favicon_url=metadata.get("favicon_url", ""),
        content=metadata.get("content", ""),
        is_favorite=False,
        is_archived=False,
    )
    db.add(db_bookmark)
    log_activity(db, current_user, "saved_pdf", db_bookmark.id)
    await db.commit()
    await db.refresh(db_bookmark)

    background_tasks.add_task(process_bookmark_ai, db_bookmark.id, db_bookmark.url, db_bookmark.title or "", db_bookmark.description or "", db_bookmark.content)
    return db_bookmark


@router.get("", response_model=List[BookmarkListItem])
async def read_bookmarks(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=MAX_PAGE_SIZE),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    stmt = (
        select(Bookmark).options(*LIST_OPTIONS)
        .where(Bookmark.user_id == current_user)
        .order_by(Bookmark.created_at.desc(), Bookmark.id)  # stable order so pages don't overlap
        .offset(skip).limit(limit)
    )
    return (await db.execute(stmt)).scalars().all()


@router.post("/ai-search", response_model=AISearchResponse)
async def ai_search_bookmarks(request: AISearchRequest, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    # 1. Keyword candidates from Postgres full-text search (title, description, summary, tags).
    fts_stmt = full_text_matches(current_user, request.query, AI_SEARCH_FULL_TEXT_LIMIT, *LIST_OPTIONS)
    text_matches = (await db.execute(fts_stmt)).scalars().all() if fts_stmt is not None else []

    # 2. Top up with recent bookmarks so semantic matches without shared words can still be found.
    seen = {b.id for b in text_matches}
    recent_stmt = (
        select(Bookmark).options(*LIST_OPTIONS)
        .where(Bookmark.user_id == current_user)
        .order_by(Bookmark.created_at.desc())
        .limit(AI_SEARCH_CANDIDATES)
    )
    recent = [b for b in (await db.execute(recent_stmt)).scalars().all() if b.id not in seen]
    bookmarks = (list(text_matches) + recent)[:AI_SEARCH_CANDIDATES]
    if not bookmarks:
        return {"matching_ids": []}

    payload = [
        {
            "id": b.id,
            "title": (b.title or "")[:200],
            "description": (b.description or "")[:300],
            "summary": (b.summary or "")[:500],
            "tags": ", ".join(t.name for t in b.tags),
        }
        for b in bookmarks
    ]
    matching_ids = await perform_semantic_search(request.query, json.dumps(payload))
    if matching_ids is None:
        # AI unavailable (no API key, quota, outage): fall back to the keyword matches.
        return {"matching_ids": [b.id for b in text_matches]}
    valid_ids = {b.id for b in bookmarks}
    return {"matching_ids": [i for i in matching_ids if i in valid_ids]}


@router.get("/{bookmark_id}", response_model=BookmarkResponse)
async def read_bookmark(bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    return await _get_owned_bookmark(db, bookmark_id, current_user)


@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    bookmark = await _get_owned_bookmark(db, bookmark_id, current_user)
    log_activity(db, current_user, "deleted", bookmark.id)
    await db.delete(bookmark)
    await db.commit()
    return {"ok": True}


@router.put("/{bookmark_id}", response_model=BookmarkListItem)
async def update_bookmark(bookmark_id: str, bookmark_update: BookmarkUpdate, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    bookmark = await _get_owned_bookmark(db, bookmark_id, current_user)

    update_data = bookmark_update.model_dump(exclude_unset=True)
    tags_list = update_data.pop("tags", None)
    for key, value in update_data.items():
        setattr(bookmark, key, value)

    if tags_list is not None:
        # De-duplicate (case-insensitively) and resolve every tag in one query.
        names = list({n.strip().lower(): n.strip() for n in tags_list if n and n.strip()}.values())
        existing = {
            t.name.lower(): t for t in (await db.execute(
                select(Tag).where(Tag.user_id == current_user, func.lower(Tag.name).in_([n.lower() for n in names]))
            )).scalars().all()
        } if names else {}
        new_tags = []
        for name in names:
            tag = existing.get(name.lower())
            if tag is None:
                tag = Tag(name=name, user_id=current_user, is_ai_generated=False)
                db.add(tag)
            new_tags.append(tag)
        bookmark.tags = new_tags

    if "is_favorite" in update_data:
        log_activity(db, current_user, "favorited" if update_data["is_favorite"] else "unfavorited", bookmark.id)
    if "is_archived" in update_data:
        log_activity(db, current_user, "archived" if update_data["is_archived"] else "unarchived", bookmark.id)
    if update_data.get("status") == "completed":
        log_activity(db, current_user, "read", bookmark.id)

    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.get("/{bookmark_id}/note", response_model=NoteResponse)
async def get_note(bookmark_id: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    bookmark = await _get_owned_bookmark(db, bookmark_id, current_user)
    if not bookmark.note:
        raise HTTPException(status_code=404, detail="Note not found")
    return bookmark.note


@router.put("/{bookmark_id}/note", response_model=NoteResponse)
async def upsert_note(bookmark_id: str, note_data: NoteUpdate, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    bookmark = await _get_owned_bookmark(db, bookmark_id, current_user)
    if bookmark.note:
        bookmark.note.content = note_data.content
    else:
        bookmark.note = Note(bookmark_id=bookmark.id, content=note_data.content)
    await db.commit()
    await db.refresh(bookmark.note)
    return bookmark.note
