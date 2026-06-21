"""Router auth: rejestracja, logowanie (OAuth2), profil, klucze API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.task_board import User
from app.schemas.auth import (
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyRead,
    Token,
    UserCreate,
    UserRead,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    return await auth_service.register_user(
        db, email=payload.email, password=payload.password, full_name=payload.full_name
    )


@router.post("/token", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
) -> Token:
    user = await auth_service.authenticate_user(db, email=form.username, password=form.password)
    return Token(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreated:
    api_key, full = await auth_service.create_api_key(db, user=user, name=payload.name)
    return ApiKeyCreated(**ApiKeyRead.model_validate(api_key).model_dump(), api_key=full)


@router.get("/api-keys", response_model=list[ApiKeyRead])
async def list_api_keys(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list:
    return await auth_service.list_api_keys(db, user=user)


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await auth_service.revoke_api_key(db, user=user, key_id=key_id)
