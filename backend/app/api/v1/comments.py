"""Router komentarzy: zagnieżdżone pod zadaniem."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.task_board import User
from app.schemas.comment import CommentCreate, CommentRead
from app.services import comments as comment_service
from app.services import tasks as task_service

router = APIRouter(tags=["comments"])


@router.get("/tasks/{task_id}/comments", response_model=Page[CommentRead])
async def list_comments(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[CommentRead]:
    await task_service.get_owned_task(db, owner_id=user.id, task_id=task_id)
    return await apaginate(db, comment_service.comments_query(task_id))


@router.post(
    "/tasks/{task_id}/comments",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    task_id: uuid.UUID,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await task_service.get_owned_task(db, owner_id=user.id, task_id=task_id)
    return await comment_service.create_comment(
        db, task=task, author_id=user.id, body=payload.body
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    comment = await comment_service.get_owned_comment(
        db, owner_id=user.id, comment_id=comment_id
    )
    await comment_service.delete_comment(db, comment=comment)
