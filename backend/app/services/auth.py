"""Auth service: registration, login, API keys. Shared layer."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    generate_api_key,
    hash_api_key,
    hash_password,
    verify_password,
)
from app.models.task_board import ApiKey, User
from app.services.exceptions import AuthenticationError, ConflictError, NotFoundError


async def register_user(
    db: AsyncSession, *, email: str, password: str, full_name: str | None
) -> User:
    existing = await db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise ConflictError("A user with this email already exists.")
    user = User(email=email, full_name=full_name, hashed_password=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, *, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.hashed_password):
        raise AuthenticationError("Incorrect email or password.")
    if not user.is_active:
        raise AuthenticationError("Account is inactive.")
    return user


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def create_api_key(db: AsyncSession, *, user: User, name: str) -> tuple[ApiKey, str]:
    full, prefix, key_hash = generate_api_key()
    api_key = ApiKey(user_id=user.id, name=name, prefix=prefix, key_hash=key_hash)
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key, full


async def get_user_by_api_key(db: AsyncSession, raw_key: str) -> User | None:
    api_key = await db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_api_key(raw_key)))
    if api_key is None:
        return None
    api_key.last_used_at = datetime.now(UTC)
    await db.commit()
    return await db.get(User, api_key.user_id)


async def list_api_keys(db: AsyncSession, *, user: User) -> list[ApiKey]:
    result = await db.scalars(
        select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc())
    )
    return list(result)


async def revoke_api_key(db: AsyncSession, *, user: User, key_id: uuid.UUID) -> None:
    api_key = await db.get(ApiKey, key_id)
    if api_key is None or api_key.user_id != user.id:
        raise NotFoundError("API key not found.")
    await db.delete(api_key)
    await db.commit()
