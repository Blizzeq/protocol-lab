"""Boards router + nested listing/creation of tasks."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.task_board import TaskStatus, User
from app.schemas.board import BoardCreate, BoardRead, BoardUpdate
from app.schemas.task import TaskCreate, TaskRead
from app.services import boards as board_service
from app.services import tasks as task_service

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=Page[BoardRead], summary="List my boards (paginated)")
async def list_boards(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Page[BoardRead]:
    return await apaginate(db, board_service.boards_query(user.id))


@router.post("", response_model=BoardRead, status_code=status.HTTP_201_CREATED)
async def create_board(
    payload: BoardCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await board_service.create_board(db, owner_id=user.id, data=payload)


@router.get("/{board_id}", response_model=BoardRead)
async def get_board(
    board_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)


@router.patch("/{board_id}", response_model=BoardRead)
async def update_board(
    board_id: uuid.UUID,
    payload: BoardUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)
    return await board_service.update_board(db, board=board, data=payload)


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    board = await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)
    await board_service.delete_board(db, board=board)


# --- Tasks within a board ---


@router.get(
    "/{board_id}/tasks",
    response_model=Page[TaskRead],
    summary="List board tasks (paginated, filter by status)",
)
async def list_tasks(
    board_id: uuid.UUID,
    status: TaskStatus | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[TaskRead]:
    board = await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)
    return await apaginate(db, task_service.tasks_query(board.id, status))


@router.post(
    "/{board_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED
)
async def create_task(
    board_id: uuid.UUID,
    payload: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await board_service.get_owned_board(db, owner_id=user.id, board_id=board_id)
    return await task_service.create_task(db, board=board, data=payload)
