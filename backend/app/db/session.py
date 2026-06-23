"""Async SQLAlchemy engine + session factory.

The engine is created lazily, so importing the application (and the /health tests) works even
without ``DATABASE_URL`` set. The settings are tuned for the Supabase pooler (pgBouncer
in transaction mode): ``NullPool`` + disabled prepared-statement cache in asyncpg.
"""

from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Fill in backend/.env with a connection string "
            "from Supabase → Connect → Transaction pooler (format: postgresql+asyncpg://...)."
        )
    return create_async_engine(
        settings.database_url,
        poolclass=NullPool,  # the Supabase pooler manages the connection pool itself
        connect_args={"statement_cache_size": 0},  # asyncpg requirement behind pgBouncer (txn mode)
        echo=settings.db_echo,
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    # expire_on_commit=False - avoid lazy-IO after commit (MissingGreenlet in async)
    return async_sessionmaker(get_engine(), expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    async with get_sessionmaker()() as session:
        yield session
