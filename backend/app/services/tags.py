"""Tag service + task-tag relationship (many-to-many)."""

from __future__ import annotations

import uuid

from sqlalchemy import Select, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_board import Board, Tag, Task, task_tags
from app.services.exceptions import ConflictError, NotFoundError, PermissionDeniedError


def tags_query(board_id: uuid.UUID) -> Select:
    return select(Tag).where(Tag.board_id == board_id).order_by(Tag.name)


def task_tags_query(task_id: uuid.UUID) -> Select:
    return (
        select(Tag)
        .join(task_tags, Tag.id == task_tags.c.tag_id)
        .where(task_tags.c.task_id == task_id)
        .order_by(Tag.name)
    )


async def create_tag(db: AsyncSession, *, board: Board, name: str, color: str) -> Tag:
    tag = Tag(board_id=board.id, name=name, color=color)
    db.add(tag)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("A tag with this name already exists on this board.") from exc
    await db.refresh(tag)
    return tag


async def get_owned_tag(db: AsyncSession, *, owner_id: uuid.UUID, tag_id: uuid.UUID) -> Tag:
    tag = await db.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError("Tag not found.")
    board = await db.get(Board, tag.board_id)
    if board is None or board.owner_id != owner_id:
        raise PermissionDeniedError("You do not have access to this tag.")
    return tag


async def delete_tag(db: AsyncSession, *, tag: Tag) -> None:
    await db.delete(tag)
    await db.commit()


async def attach_tag(db: AsyncSession, *, task: Task, tag: Tag) -> None:
    if tag.board_id != task.board_id:
        raise ConflictError("The tag belongs to a different board than the task.")
    # ON CONFLICT DO NOTHING — idempotent operation, no relationship loading (async-safe)
    await db.execute(
        pg_insert(task_tags).values(task_id=task.id, tag_id=tag.id).on_conflict_do_nothing()
    )
    await db.commit()


async def detach_tag(db: AsyncSession, *, task: Task, tag: Tag) -> None:
    await db.execute(
        delete(task_tags).where(
            task_tags.c.task_id == task.id, task_tags.c.tag_id == tag.id
        )
    )
    await db.commit()
