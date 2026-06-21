"""Zależności FastAPI dla REST v1 — przede wszystkim uwierzytelnienie."""

from __future__ import annotations

import uuid

from fastapi import Depends
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.task_board import User
from app.services import auth as auth_service
from app.services.exceptions import AuthenticationError

# auto_error=False — sami zwracamy spójny błąd RFC 9457, obsługując oba mechanizmy.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Uwierzytelnia przez token Bearer (JWT) ALBO nagłówek X-API-Key."""
    if token:
        subject = decode_access_token(token)
        if subject:
            try:
                user = await auth_service.get_user(db, uuid.UUID(subject))
            except ValueError:
                user = None
            if user is not None and user.is_active:
                return user

    if api_key:
        user = await auth_service.get_user_by_api_key(db, api_key)
        if user is not None and user.is_active:
            return user

    raise AuthenticationError("Wymagane uwierzytelnienie: token Bearer lub nagłówek X-API-Key.")
