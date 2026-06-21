"""GraphQL types (Strawberry) + relation resolvers via DataLoaders."""

from __future__ import annotations

import uuid
from datetime import datetime

import strawberry

from app.models.task_board import (
    Board,
    Comment,
    Tag,
    Task,
    TaskPriority,
    TaskStatus,
    User,
)

TaskStatusEnum = strawberry.enum(TaskStatus, name="TaskStatus")
TaskPriorityEnum = strawberry.enum(TaskPriority, name="TaskPriority")


@strawberry.type
class UserType:
    id: uuid.UUID
    email: str
    full_name: str | None
    is_active: bool
    created_at: datetime

    @classmethod
    def from_model(cls, u: User) -> UserType:
        return cls(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            created_at=u.created_at,
        )


@strawberry.type
class TagType:
    id: uuid.UUID
    board_id: uuid.UUID
    name: str
    color: str

    @classmethod
    def from_model(cls, t: Tag) -> TagType:
        return cls(id=t.id, board_id=t.board_id, name=t.name, color=t.color)


@strawberry.type
class CommentType:
    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime

    @classmethod
    def from_model(cls, c: Comment) -> CommentType:
        return cls(
            id=c.id,
            task_id=c.task_id,
            author_id=c.author_id,
            body=c.body,
            created_at=c.created_at,
        )


@strawberry.type
class TaskType:
    id: uuid.UUID
    board_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatusEnum
    priority: TaskPriorityEnum
    position: int
    assignee_id: uuid.UUID | None
    due_date: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, t: Task) -> TaskType:
        return cls(
            id=t.id,
            board_id=t.board_id,
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            position=t.position,
            assignee_id=t.assignee_id,
            due_date=t.due_date,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )

    @strawberry.field
    async def comments(self, info: strawberry.Info) -> list[CommentType]:
        rows = await info.context.loaders["comments_by_task"].load(self.id)
        return [CommentType.from_model(c) for c in rows]

    @strawberry.field
    async def tags(self, info: strawberry.Info) -> list[TagType]:
        rows = await info.context.loaders["tags_by_task"].load(self.id)
        return [TagType.from_model(t) for t in rows]

    @strawberry.field
    async def assignee(self, info: strawberry.Info) -> UserType | None:
        if self.assignee_id is None:
            return None
        user = await info.context.loaders["user"].load(self.assignee_id)
        return UserType.from_model(user) if user else None


@strawberry.type
class BoardType:
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, b: Board) -> BoardType:
        return cls(
            id=b.id,
            owner_id=b.owner_id,
            name=b.name,
            description=b.description,
            created_at=b.created_at,
            updated_at=b.updated_at,
        )

    @strawberry.field
    async def tasks(self, info: strawberry.Info) -> list[TaskType]:
        rows = await info.context.loaders["tasks_by_board"].load(self.id)
        return [TaskType.from_model(t) for t in rows]

    @strawberry.field
    async def owner(self, info: strawberry.Info) -> UserType | None:
        user = await info.context.loaders["user"].load(self.owner_id)
        return UserType.from_model(user) if user else None
