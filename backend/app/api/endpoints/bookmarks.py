from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select
import json
from typing import List
from ...core.database import get_db
from ...models.bookmark import Bookmark
from ...models.tag import Tag
from ...models.note import Note
from ...schemas.bookmark import BookmarkCreate, BookmarkUpdate, BookmarkResponse, URLMetadataRequest, URLMetadataResponse, AISearchRequest, AISearchResponse
from ...schemas.note import NoteCreate, NoteUpdate, NoteResponse
from ...services.metadata_extractor import extract_metadata
from ...services.pdf_extractor import extract_local_pdf
from ...services.background_tasks import process_bookmark_ai
from ...services.ai_service import perform_semantic_search
from ...services.activity_service import log_activity
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/extract-metadata", response_model=URLMetadataResponse)
async def get_metadata(request: URLMetadataRequest, current_user: str = Depends(get_current_user)):
    # Convert HttpUrl to string
    url_str = str(request.url)
    data = await extract_metadata(url_str)
    return data

@router.post("", response_model=BookmarkResponse)
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
        summary=bookmark.ai_summary,
        content=bookmark.content
    )
    db.add(db_bookmark)
    await db.commit()
    await db.refresh(db_bookmark)
    
    # Spawn AI tagging and summarization in background
    background_tasks.add_task(process_bookmark_ai, db_bookmark.id, db_bookmark.url, db_bookmark.title or "", db_bookmark.description or "", db_bookmark.content)
    
    log_activity(db, current_user, "saved", db_bookmark.id)
    await db.commit() # commit the activity
    return db_bookmark

@router.post("/pdf", response_model=BookmarkResponse)
async def upload_pdf_bookmark(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    pdf_bytes = await file.read()
    
    # Extract metadata using pypdf
    metadata = extract_local_pdf(pdf_bytes, file.filename)
    
    # Create bookmark based on extracted data
    db_bookmark = Bookmark(
        user_id=current_user,
        url=f"local://{uuid.uuid4()}/{file.filename}", # Fake URL for local file
        title=metadata.get("title", file.filename),
        description=metadata.get("description", "Uploaded PDF Document"),
        favicon_url=metadata.get("favicon_url", ""),
        content=metadata.get("content", ""),
        is_favorite=False,
        is_archived=False
    )
    db.add(db_bookmark)
    await db.commit()
    await db.refresh(db_bookmark)
    
    # Spawn AI tagging and summarization in background
    background_tasks.add_task(process_bookmark_ai, db_bookmark.id, db_bookmark.url, db_bookmark.title or "", db_bookmark.description or "", db_bookmark.content)
    
    log_activity(db, current_user, "saved_pdf", db_bookmark.id)
    await db.commit()
    return db_bookmark

@router.get("", response_model=List[BookmarkResponse])
async def read_bookmarks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.user_id == current_user).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/ai-search", response_model=AISearchResponse)
async def ai_search_bookmarks(request: AISearchRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # 1. Fetch all bookmarks for user
    stmt = select(Bookmark).where(Bookmark.user_id == current_user)
    result = await db.execute(stmt)
    bookmarks = result.scalars().all()
    
    # 2. Format a compact payload for the LLM
    bookmarks_payload = []
    for b in bookmarks:
        tags_str = ", ".join([t.name for t in b.tags]) if b.tags else ""
        bookmarks_payload.append({
            "id": b.id,
            "title": b.title or "",
            "description": b.description or "",
            "summary": b.summary or "",
            "tags": tags_str
        })
        
    # 3. Call AI Service
    matching_ids = await perform_semantic_search(request.query, json.dumps(bookmarks_payload))
    return {"matching_ids": matching_ids}

@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    result = await db.execute(stmt)
    bookmark = result.scalar_one_or_none()
    
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    log_activity(db, current_user, "deleted", bookmark.id)
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
    tags_list = update_data.pop('tags', None)
    
    for key, value in update_data.items():
        if hasattr(bookmark, key):
            if key == 'url' and value is not None:
                setattr(bookmark, key, str(value))
            else:
                setattr(bookmark, key, value)
                
    if tags_list is not None:
        # Clear existing tags
        bookmark.tags.clear()
        for tag_name in tags_list:
            if tag_name.strip():
                # Check if tag exists for this user
                stmt_tag = select(Tag).where(Tag.name == tag_name.strip(), Tag.user_id == current_user)
                result_tag = await db.execute(stmt_tag)
                tag = result_tag.scalar_one_or_none()
                if not tag:
                    tag = Tag(name=tag_name.strip(), user_id=current_user, is_ai_generated=False)
                    db.add(tag)
                bookmark.tags.append(tag)
            
    if 'is_favorite' in update_data:
        log_activity(db, current_user, "favorited" if update_data['is_favorite'] else "unfavorited", bookmark.id)
    if 'is_archived' in update_data:
        log_activity(db, current_user, "archived" if update_data['is_archived'] else "unarchived", bookmark.id)
        
    await db.commit()
    await db.refresh(bookmark)
    return bookmark

@router.get("/{bookmark_id}/note", response_model=NoteResponse)
async def get_note(bookmark_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    result = await db.execute(stmt)
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    if not bookmark.note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    return bookmark.note

@router.put("/{bookmark_id}/note", response_model=NoteResponse)
async def upsert_note(bookmark_id: str, note_data: NoteUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    stmt = select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user)
    result = await db.execute(stmt)
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    if bookmark.note:
        bookmark.note.content = note_data.content
    else:
        new_note = Note(bookmark_id=bookmark.id, content=note_data.content)
        db.add(new_note)
        bookmark.note = new_note
        
    await db.commit()
    # Need to refresh the note to get updated_at/created_at
    if bookmark.note:
        await db.refresh(bookmark.note)
    return bookmark.note
