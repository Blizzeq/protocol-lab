"""DataLoadery — batchowanie zapytań relacyjnych (anty-N+1).

Tworzone PER REQUEST (w kontekście), nigdy globalnie — inaczej cache wyciekałby
między requestami/użytkownikami.
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader

from app.models.task_board import Comment, Tag, Task, User, task_tags


def make_loaders(db: AsyncSession) -> dict[str, DataLoader]:
    async def load_users(keys: list[uuid.UUID]) -> list[User | None]:
        rows = (await db.scalars(select(User).where(User.id.in_(keys)))).all()
        by_id = {u.id: u for u in rows}
        return [by_id.get(k) for k in keys]

    async def load_tasks_by_board(keys: list[uuid.UUID]) -> list[list[Task]]:
        rows = (await db.scalars(select(Task).where(Task.board_id.in_(keys)))).all()
        grouped: dict[uuid.UUID, list[Task]] = defaultdict(list)
        for task in rows:
            grouped[task.board_id].append(task)
        return [grouped.get(k, []) for k in keys]

    async def load_comments_by_task(keys: list[uuid.UUID]) -> list[list[Comment]]:
        rows = (await db.scalars(select(Comment).where(Comment.task_id.in_(keys)))).all()
        grouped: dict[uuid.UUID, list[Comment]] = defaultdict(list)
        for comment in rows:
            grouped[comment.task_id].append(comment)
        return [grouped.get(k, []) for k in keys]

    async def load_tags_by_task(keys: list[uuid.UUID]) -> list[list[Tag]]:
        stmt = (
            select(task_tags.c.task_id, Tag)
            .join(Tag, Tag.id == task_tags.c.tag_id)
            .where(task_tags.c.task_id.in_(keys))
        )
        grouped: dict[uuid.UUID, list[Tag]] = defaultdict(list)
        for task_id, tag in (await db.execute(stmt)).all():
            grouped[task_id].append(tag)
        return [grouped.get(k, []) for k in keys]

    return {
        "user": DataLoader(load_fn=load_users),
        "tasks_by_board": DataLoader(load_fn=load_tasks_by_board),
        "comments_by_task": DataLoader(load_fn=load_comments_by_task),
        "tags_by_task": DataLoader(load_fn=load_tags_by_task),
    }
