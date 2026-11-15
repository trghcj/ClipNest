import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

db_url = settings.SUPABASE_DB_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgres://", "postgresql+asyncpg://")
engine = create_async_engine(
    db_url,
    # SQL echo logs every statement *and its parameters* (including full page
    # content). Keep it off in production; opt in locally with SQL_ECHO=1.
    echo=os.getenv("SQL_ECHO") == "1",
    # Supabase's pooler drops idle connections; detect them instead of failing a request.
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
