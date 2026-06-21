"""Task service — logic + authorization via the board owner."""

from __future__ import annotations

import uuid

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_board import Board, Task, TaskStatus
from app.realtime.events import emit
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.exceptions import NotFoundError, PermissionDeniedError


def _task_payload(task: Task) -> dict:
    return {"id": str(task.id), "title": task.title, "status": task.status.value}


def tasks_query(board_id: uuid.UUID, status: TaskStatus | None = None) -> Select:
    stmt = select(Task).where(Task.board_id == board_id)
    if status is not None:
        stmt = stmt.where(Task.status == status)
    return stmt.order_by(Task.position, Task.created_at)


async def create_task(db: AsyncSession, *, board: Board, data: TaskCreate) -> Task:
    task = Task(board_id=board.id, **data.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await emit("task.created", board_id=task.board_id, payload=_task_payload(task))
    return task


async def get_owned_task(
    db: AsyncSession, *, owner_id: uuid.UUID, task_id: uuid.UUID
) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found.")
    board = await db.get(Board, task.board_id)
    if board is None or board.owner_id != owner_id:
        raise PermissionDeniedError("You do not have access to this task.")
    return task


async def update_task(db: AsyncSession, *, task: Task, data: TaskUpdate) -> Task:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    await emit("task.updated", board_id=task.board_id, payload=_task_payload(task))
    return task


async def delete_task(db: AsyncSession, *, task: Task) -> None:
    payload = {"id": str(task.id)}
    board_id = task.board_id
    await db.delete(task)
    await db.commit()
    await emit("task.deleted", board_id=board_id, payload=payload)
