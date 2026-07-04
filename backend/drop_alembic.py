import asyncio
from app.core.database import engine
from sqlalchemy import text

async def drop_alembic():
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version;"))
    print("Dropped alembic_version table")

if __name__ == "__main__":
    asyncio.run(drop_alembic())
