"""Schemat GraphQL — Query / Mutation / Subscription.

Resolvery wołają tę samą warstwę `services/` co REST → identyczne dane i autoryzacja.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncGenerator

import strawberry

from app.graphql.context import require_user
from app.graphql.types import (
    BoardType,
    TaskPriorityEnum,
    TaskStatusEnum,
    TaskType,
    UserType,
)
from app.models.task_board import TaskPriority
from app.schemas.board import BoardCreate
from app.schemas.task import TaskCreate, TaskUpdate
from app.services import boards as board_service
from app.services import tasks as task_service


@strawberry.type
class Query:
    @strawberry.field
    async def me(self, info: strawberry.Info) -> UserType | None:
        user = info.context.user
        return UserType.from_model(user) if user else None

    @strawberry.field
    async def boards(self, info: strawberry.Info) -> list[BoardType]:
        user = require_user(info)
        rows = await info.context.db.scalars(board_service.boards_query(user.id))
        return [BoardType.from_model(b) for b in rows]

    @strawberry.field
    async def board(self, info: strawberry.Info, id: uuid.UUID) -> BoardType:
        user = require_user(info)
        board = await board_service.get_owned_board(
            info.context.db, owner_id=user.id, board_id=id
        )
        return BoardType.from_model(board)

    @strawberry.field
    async def task(self, info: strawberry.Info, id: uuid.UUID) -> TaskType:
        user = require_user(info)
        task = await task_service.get_owned_task(
            info.context.db, owner_id=user.id, task_id=id
        )
        return TaskType.from_model(task)


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_board(
        self, info: strawberry.Info, name: str, description: str | None = None
    ) -> BoardType:
        user = require_user(info)
        board = await board_service.create_board(
            info.context.db, owner_id=user.id, data=BoardCreate(name=name, description=description)
        )
        return BoardType.from_model(board)

    @strawberry.mutation
    async def create_task(
        self,
        info: strawberry.Info,
        board_id: uuid.UUID,
        title: str,
        description: str | None = None,
        priority: TaskPriorityEnum = TaskPriority.medium,
    ) -> TaskType:
        user = require_user(info)
        board = await board_service.get_owned_board(
            info.context.db, owner_id=user.id, board_id=board_id
        )
        task = await task_service.create_task(
            info.context.db,
            board=board,
            data=TaskCreate(title=title, description=description, priority=priority),
        )
        return TaskType.from_model(task)

    @strawberry.mutation
    async def update_task_status(
        self, info: strawberry.Info, task_id: uuid.UUID, status: TaskStatusEnum
    ) -> TaskType:
        user = require_user(info)
        task = await task_service.get_owned_task(
            info.context.db, owner_id=user.id, task_id=task_id
        )
        task = await task_service.update_task(
            info.context.db, task=task, data=TaskUpdate(status=status)
        )
        return TaskType.from_model(task)


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def count(self, target: int = 5) -> AsyncGenerator[int]:
        """Demo subskrypcji (po WebSocket): emituje 0..target-1 co sekundę.

        Pełny pub/sub na zdarzeniach domenowych dojdzie w M3 (real-time).
        """
        for i in range(target):
            yield i
            await asyncio.sleep(1)


schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)
