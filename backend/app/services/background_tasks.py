import asyncio
from app.core.database import AsyncSessionLocal
from app.models.bookmark import Bookmark
from app.models.collection import Collection, CollectionBookmark
from app.models.tag import Tag
from app.services.ai_service import generate_bookmark_metadata
from sqlalchemy import select, insert

async def process_bookmark_ai(bookmark_id: str, url: str, title: str, description: str, content: str = None):
    """Background task to generate AI tags, summary, and auto-categorization."""
    async with AsyncSessionLocal() as db:
        # Fetch the bookmark to get user_id
        stmt = select(Bookmark).where(Bookmark.id == bookmark_id)
        result = await db.execute(stmt)
        bookmark = result.scalar_one_or_none()
        
        if not bookmark:
            return

        # Fetch user's existing collections
        col_stmt = select(Collection).where(Collection.user_id == bookmark.user_id)
        col_result = await db.execute(col_stmt)
        user_collections = col_result.scalars().all()
        collection_names = [c.name for c in user_collections]

        # Run the AI generation
        ai_result = await generate_bookmark_metadata(url, title, description, collection_names, content)
        
        if not ai_result.summary and not ai_result.tags:
            return # Generation failed

        # Update summary
        if ai_result.summary:
            bookmark.summary = ai_result.summary

        # Process Auto-Categorization
        if ai_result.suggested_collection:
            suggested = ai_result.suggested_collection.strip()
            matched_col = next((c for c in user_collections if c.name.lower() == suggested.lower()), None)
            
            if not matched_col:
                # Create new collection
                matched_col = Collection(name=suggested, user_id=bookmark.user_id)
                db.add(matched_col)
                await db.flush()
            
            # Check if bookmark is already in a collection
            check_stmt = select(CollectionBookmark).where(CollectionBookmark.bookmark_id == bookmark.id)
            has_col = await db.execute(check_stmt)
            if not has_col.first():
                new_cb = CollectionBookmark(collection_id=matched_col.id, bookmark_id=bookmark.id)
                db.add(new_cb)
                await db.flush()

        # Process Tags
        for tag_name in ai_result.tags:
            tag_name_clean = tag_name.lower().strip()
            if not tag_name_clean:
                continue
                
            # Check if tag exists
            tag_stmt = select(Tag).where(Tag.name == tag_name_clean)
            tag_result = await db.execute(tag_stmt)
            tag = tag_result.scalar_one_or_none()
            
            if not tag:
                tag = Tag(name=tag_name_clean)
                db.add(tag)
                await db.flush() # flush to get the ID
            
            # Avoid duplicate tags on the same bookmark
            if tag not in bookmark.tags:
                bookmark.tags.append(tag)

        await db.commit()
