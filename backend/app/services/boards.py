"""Board service — logic + owner authorization. Shared layer."""

from __future__ import annotations

import uuid

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_board import Board
from app.realtime.events import emit
from app.schemas.board import BoardCreate, BoardUpdate
from app.services.exceptions import NotFoundError, PermissionDeniedError


def boards_query(owner_id: uuid.UUID) -> Select:
    """Select the user's boards (for pagination)."""
    return select(Board).where(Board.owner_id == owner_id).order_by(Board.created_at.desc())


async def create_board(db: AsyncSession, *, owner_id: uuid.UUID, data: BoardCreate) -> Board:
    board = Board(owner_id=owner_id, name=data.name, description=data.description)
    db.add(board)
    await db.commit()
    await db.refresh(board)
    await emit(
        "board.created", board_id=board.id, payload={"id": str(board.id), "name": board.name}
    )
    return board


async def get_owned_board(
    db: AsyncSession, *, owner_id: uuid.UUID, board_id: uuid.UUID
) -> Board:
    board = await db.get(Board, board_id)
    if board is None:
        raise NotFoundError("Board not found.")
    if board.owner_id != owner_id:
        raise PermissionDeniedError("You do not have access to this board.")
    return board


async def update_board(db: AsyncSession, *, board: Board, data: BoardUpdate) -> Board:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(board, field, value)
    await db.commit()
    await db.refresh(board)
    return board


async def delete_board(db: AsyncSession, *, board: Board) -> None:
    await db.delete(board)
    await db.commit()
