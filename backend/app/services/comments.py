"""Comment service — authorization via the owner of the task's board."""

from __future__ import annotations

import uuid

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_board import Board, Comment, Task
from app.services.exceptions import NotFoundError, PermissionDeniedError


def comments_query(task_id: uuid.UUID) -> Select:
    return select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at)


async def create_comment(
    db: AsyncSession, *, task: Task, author_id: uuid.UUID, body: str
) -> Comment:
    comment = Comment(task_id=task.id, author_id=author_id, body=body)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def get_owned_comment(
    db: AsyncSession, *, owner_id: uuid.UUID, comment_id: uuid.UUID
) -> Comment:
    comment = await db.get(Comment, comment_id)
    if comment is None:
        raise NotFoundError("Comment not found.")
    task = await db.get(Task, comment.task_id)
    board = await db.get(Board, task.board_id) if task else None
    if board is None or board.owner_id != owner_id:
        raise PermissionDeniedError("You do not have access to this comment.")
    return comment


async def delete_comment(db: AsyncSession, *, comment: Comment) -> None:
    await db.delete(comment)
    await db.commit()
