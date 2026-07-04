import asyncio
from app.core.database import AsyncSessionLocal
from app.models.bookmark import Bookmark
from app.models.tag import Tag
from app.services.ai_service import generate_bookmark_metadata
from sqlalchemy import select

async def process_bookmark_ai(bookmark_id: str, url: str, title: str, description: str):
    """Background task to generate AI tags and summary for a newly saved bookmark."""
    # Run the AI generation
    ai_result = await generate_bookmark_metadata(url, title, description)
    
    if not ai_result.summary and not ai_result.tags:
        return # Generation failed or API key missing

    async with AsyncSessionLocal() as db:
        # Fetch the bookmark
        stmt = select(Bookmark).where(Bookmark.id == bookmark_id)
        result = await db.execute(stmt)
        bookmark = result.scalar_one_or_none()
        
        if not bookmark:
            return # Bookmark might have been deleted quickly

        # Update summary
        if ai_result.summary:
            bookmark.summary = ai_result.summary

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
