import logging

from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal
from app.models.bookmark import Bookmark
from app.models.collection import Collection, CollectionBookmark
from app.models.tag import Tag
from app.services.ai_service import generate_bookmark_metadata

logger = logging.getLogger(__name__)


async def process_bookmark_ai(bookmark_id: str, url: str, title: str, description: str, content: str = None):
    """Background task to generate AI tags, summary, and auto-categorization."""
    async with AsyncSessionLocal() as db:
        try:
            bookmark = (await db.execute(select(Bookmark).where(Bookmark.id == bookmark_id))).scalar_one_or_none()
            if not bookmark:
                return
            user_id = bookmark.user_id

            user_collections = (await db.execute(select(Collection).where(Collection.user_id == user_id))).scalars().all()
            ai_result = await generate_bookmark_metadata(url, title, description, [c.name for c in user_collections], content)
            if not ai_result.summary and not ai_result.tags:
                return  # Generation failed or AI disabled

            if ai_result.summary:
                bookmark.summary = ai_result.summary

            # Auto-categorization: only if the bookmark isn't in any collection yet.
            suggested = (ai_result.suggested_collection or "").strip()
            if suggested:
                already_filed = (await db.execute(
                    select(CollectionBookmark.bookmark_id).where(CollectionBookmark.bookmark_id == bookmark.id).limit(1)
                )).first()
                if not already_filed:
                    collection = next((c for c in user_collections if c.name.lower() == suggested.lower()), None)
                    if not collection:
                        collection = Collection(name=suggested, user_id=user_id)
                        db.add(collection)
                        await db.flush()
                    db.add(CollectionBookmark(collection_id=collection.id, bookmark_id=bookmark.id))

            # Tags belong to a user: look up / create them in this user's namespace only.
            wanted = list(dict.fromkeys(t.lower().strip() for t in ai_result.tags if t and t.strip()))
            if wanted:
                existing = {
                    t.name.lower(): t for t in (await db.execute(
                        select(Tag).where(Tag.user_id == user_id, func.lower(Tag.name).in_(wanted))
                    )).scalars().all()
                }
                current_ids = {t.id for t in bookmark.tags}
                for name in wanted:
                    tag = existing.get(name)
                    if tag is None:
                        tag = Tag(name=name, user_id=user_id, is_ai_generated=True)
                        db.add(tag)
                        existing[name] = tag
                    if tag.id is None or tag.id not in current_ids:
                        bookmark.tags.append(tag)

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("AI processing failed for bookmark %s", bookmark_id)
