"""MCP server (FastMCP) exposing Protocol Lab data to AI clients like Claude.

Curated, well-described tools over the SAME service layer as REST/GraphQL — not an
auto-mirror of every endpoint (LLMs do better with a few focused tools). The server
acts as one Protocol Lab user, identified by the MCP_API_KEY env var (a `pl_` API key).

Run locally (stdio):   uv run fastmcp run app/mcp_server.py
Remote (Streamable HTTP) is mounted by app/main.py at /mcp.
"""

from __future__ import annotations

import uuid

from fastmcp import FastMCP
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_sessionmaker
from app.models.task_board import User
from app.schemas.task import TaskCreate
from app.services import auth as auth_service
from app.services import boards as board_service
from app.services import tasks as task_service

mcp = FastMCP("protocol-lab")

_NO_KEY = "MCP_API_KEY is not set. Configure a Protocol Lab API key (pl_...) to use this server."


async def _user(db: AsyncSession) -> User | None:
    settings = get_settings()
    if not settings.mcp_api_key:
        return None
    return await auth_service.get_user_by_api_key(db, settings.mcp_api_key)


@mcp.tool
async def whoami() -> dict:
    """Return the Protocol Lab user this MCP server is acting as."""
    sm = get_sessionmaker()
    async with sm() as db:
        user = await _user(db)
        if user is None:
            return {"error": _NO_KEY}
        return {"id": str(user.id), "email": user.email, "full_name": user.full_name}


@mcp.tool
async def list_boards() -> list[dict]:
    """List the boards owned by the configured user."""
    sm = get_sessionmaker()
    async with sm() as db:
        user = await _user(db)
        if user is None:
            return [{"error": _NO_KEY}]
        boards = list(await db.scalars(board_service.boards_query(user.id)))
        return [{"id": str(b.id), "name": b.name, "description": b.description} for b in boards]


@mcp.tool
async def list_tasks(board_id: str) -> list[dict]:
    """List tasks in a board, given the board's id."""
    sm = get_sessionmaker()
    async with sm() as db:
        user = await _user(db)
        if user is None:
            return [{"error": _NO_KEY}]
        await board_service.get_owned_board(db, owner_id=user.id, board_id=uuid.UUID(board_id))
        rows = list(await db.scalars(task_service.tasks_query(uuid.UUID(board_id))))
        return [{"id": str(t.id), "title": t.title, "status": t.status.value} for t in rows]


@mcp.tool
async def search_tasks(query: str) -> list[dict]:
    """Search the user's tasks by title (case-insensitive substring match)."""
    sm = get_sessionmaker()
    async with sm() as db:
        user = await _user(db)
        if user is None:
            return [{"error": _NO_KEY}]
        rows = list(await db.scalars(task_service.search_query(user.id, query)))
        return [
            {
                "id": str(t.id),
                "title": t.title,
                "status": t.status.value,
                "board_id": str(t.board_id),
            }
            for t in rows
        ]


@mcp.tool
async def create_task(board_id: str, title: str) -> dict:
    """Create a new task in a board. Also triggers real-time + webhook events."""
    sm = get_sessionmaker()
    async with sm() as db:
        user = await _user(db)
        if user is None:
            return {"error": _NO_KEY}
        board = await board_service.get_owned_board(
            db, owner_id=user.id, board_id=uuid.UUID(board_id)
        )
        task = await task_service.create_task(db, board=board, data=TaskCreate(title=title))
        return {"id": str(task.id), "title": task.title, "status": task.status.value}


if __name__ == "__main__":
    mcp.run()  # stdio transport for local use
