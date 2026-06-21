"""Router tagów: tagi tablicy + przypisywanie tagów do zadań."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.task_board import User
from app.schemas.tag import TagCreate, TagRead
from app.services import boards as board_service
from app.services import tags as tag_service
from app.services import tasks as task_service

router = APIRouter(tags=["tags"])


@router.get("/boards/{board_id}/tags", response_model=list[TagRead])
async def list_tags(
    board_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)
    return list(await db.scalars(tag_service.tags_query(board_id)))


@router.post(
    "/boards/{board_id}/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED
)
async def create_tag(
    board_id: uuid.UUID,
    payload: TagCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)
    return await tag_service.create_tag(db, board=board, name=payload.name, color=payload.color)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    tag = await tag_service.get_owned_tag(db, owner_id=user.id, tag_id=tag_id)
    await tag_service.delete_tag(db, tag=tag)


@router.get("/tasks/{task_id}/tags", response_model=list[TagRead])
async def list_task_tags(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    await task_service.get_owned_task(db, owner_id=user.id, task_id=task_id)
    return list(await db.scalars(tag_service.task_tags_query(task_id)))


@router.put("/tasks/{task_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def attach_tag(
    task_id: uuid.UUID,
    tag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    task = await task_service.get_owned_task(db, owner_id=user.id, task_id=task_id)
    tag = await tag_service.get_owned_tag(db, owner_id=user.id, tag_id=tag_id)
    await tag_service.attach_tag(db, task=task, tag=tag)


@router.delete("/tasks/{task_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def detach_tag(
    task_id: uuid.UUID,
    tag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    task = await task_service.get_owned_task(db, owner_id=user.id, task_id=task_id)
    tag = await tag_service.get_owned_tag(db, owner_id=user.id, tag_id=tag_id)
    await tag_service.detach_tag(db, task=task, tag=tag)
