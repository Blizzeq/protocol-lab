"""GraphQL context: DB session, current user (optional) and DataLoaders.

Authentication works the same way as in REST (Bearer JWT or X-API-Key) - we reuse
the security schemes and the auth service.
"""

from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from strawberry.fastapi import BaseContext

from app.api.v1.deps import api_key_scheme, oauth2_scheme
from app.core.security import decode_access_token
from app.db.session import get_db
from app.graphql.loaders import make_loaders
from app.models.task_board import User
from app.services import auth as auth_service
from app.services.exceptions import AuthenticationError


class Context(BaseContext):
    def __init__(
        self, db: AsyncSession, user: User | None, loaders: dict[str, DataLoader]
    ) -> None:
        super().__init__()
        self.db = db
        self.user = user
        self.loaders = loaders


async def _resolve_user(
    db: AsyncSession, token: str | None, api_key: str | None
) -> User | None:
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
    return None


async def get_context(
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_scheme),
) -> Context:
    user = await _resolve_user(db, token, api_key)
    return Context(db=db, user=user, loaders=make_loaders(db))


def require_user(info) -> User:
    """Returns the logged-in user from the context or raises an auth error."""
    user = info.context.user
    if user is None:
        raise AuthenticationError("Authentication required (Bearer token or X-API-Key).")
    return user
