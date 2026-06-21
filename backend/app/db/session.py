"""Async silnik + fabryka sesji SQLAlchemy.

Silnik tworzony jest leniwie, więc import aplikacji (i testy /health) działają nawet
bez ustawionego ``DATABASE_URL``. Ustawienia są dobrane pod pooler Supabase (pgBouncer
w trybie transaction): ``NullPool`` + wyłączony cache prepared-statements w asyncpg.
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
            "DATABASE_URL nie jest ustawione. Uzupełnij backend/.env connection stringiem "
            "z Supabase → Connect → Transaction pooler (format: postgresql+asyncpg://...)."
        )
    return create_async_engine(
        settings.database_url,
        poolclass=NullPool,  # pooler Supabase sam zarządza pulą połączeń
        connect_args={"statement_cache_size": 0},  # wymóg asyncpg za pgBouncer (transaction mode)
        echo=settings.environment == "development",
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    # expire_on_commit=False — unikamy lazy-IO po commicie (MissingGreenlet w async)
    return async_sessionmaker(get_engine(), expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Dependency FastAPI: jedna sesja na request."""
    async with get_sessionmaker()() as session:
        yield session
