import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def run_migration():
    async with AsyncSessionLocal() as db:
        try:
            # Add column if not exists
            await db.execute(text("ALTER TABLE clipnest_bookmarks ADD COLUMN IF NOT EXISTS archive_url VARCHAR;"))
            await db.commit()
            print("Added archive_url column.")
        except Exception as e:
            await db.rollback()
            print("Column alter error:", e)

        # Iterate all bookmarks and update in one query
        await db.execute(text("UPDATE clipnest_bookmarks SET archive_url = 'https://web.archive.org/web/2/' || url WHERE archive_url IS NULL"))
        await db.commit()
        print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(run_migration())
