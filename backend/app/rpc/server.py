"""Connect RPC service implementations, mounted under FastAPI at /rpc.

connect-python serves the Connect, gRPC and gRPC-Web protocols from one ASGI app,
so the browser can call it directly (no Envoy/grpc-web proxy needed).

Two services share the /rpc mount via a tiny path-prefix router, so the
browser-facing URLs stay /rpc/protocollab.v1.<Service>/<Method>.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from sqlalchemy import func, select

from app.db.session import get_sessionmaker
from app.models.task_board import Task, TaskStatus
from app.realtime.bus import bus

# Importing this module triggers app/rpc/__init__.py first, which puts gen/ on sys.path,
# so the generated `protocollab.*` imports below resolve.
from protocollab.v1.greet_connect import (
    BoardServiceASGIApplication,
    GreetServiceASGIApplication,
)
from protocollab.v1.greet_pb2 import (
    BoardEvent,
    BoardStatsRequest,
    BoardStatsResponse,
    GreetRequest,
    GreetResponse,
    WatchRequest,
)

SERVED_BY = "Protocol Lab (Connect/Python)"


class GreetServiceImpl:
    async def greet(self, request: GreetRequest, ctx) -> GreetResponse:
        name = request.name or "world"
        return GreetResponse(greeting=f"Hello, {name}!", served_by=SERVED_BY)


class BoardServiceImpl:
    """A real typed contract over the shared task-board data + event bus."""

    async def get_board_stats(self, request: BoardStatsRequest, ctx) -> BoardStatsResponse:
        try:
            board_id = uuid.UUID(request.board_id)
        except (ValueError, AttributeError):
            return BoardStatsResponse()
        sm = get_sessionmaker()
        async with sm() as db:
            rows = (
                await db.execute(
                    select(Task.status, func.count())
                    .where(Task.board_id == board_id)
                    .group_by(Task.status)
                )
            ).all()
            # "members" = distinct assignees on the board (the only honest count we
            # can derive — there is no board-membership table).
            members = (
                await db.scalar(
                    select(func.count(func.distinct(Task.assignee_id))).where(
                        Task.board_id == board_id,
                        Task.assignee_id.is_not(None),
                    )
                )
            ) or 0
        counts = {s.value: 0 for s in TaskStatus}
        for status, n in rows:
            key = status.value if hasattr(status, "value") else str(status)
            counts[key] = n
        return BoardStatsResponse(
            total=sum(counts.values()),
            todo=counts["todo"],
            in_progress=counts["in_progress"],
            done=counts["done"],
            members=int(members),
        )

    async def watch_board(self, request: WatchRequest, ctx) -> AsyncIterator[BoardEvent]:
        # Stream a typed frame for every task.* change on this board, fed by the same
        # in-process EventBus that drives SSE/WebSocket and webhooks.
        seq = 0
        async with bus.subscribe() as queue:
            while True:
                event = await queue.get()
                if event.get("board_id") != request.board_id:
                    continue
                etype = event.get("type", "")
                if not etype.startswith("task."):
                    continue
                seq += 1
                payload = event.get("payload") or {}
                yield BoardEvent(seq=seq, type=etype, task_id=str(payload.get("id", "")))


class _RpcRouter:
    """Dispatch Connect requests to the right generated ASGI app by service path.

    Each generated app only routes its own ``/protocollab.v1.<Service>/...`` paths,
    so we mount one router at ``/rpc`` and forward by path prefix. Mounted apps
    receive the path already stripped of the ``/rpc`` prefix by Starlette.
    """

    def __init__(self) -> None:
        self._greet = GreetServiceASGIApplication(GreetServiceImpl())
        self._board = BoardServiceASGIApplication(BoardServiceImpl())

    async def __call__(self, scope, receive, send):
        # The path may still carry the /rpc mount prefix (Starlette leaves it in
        # scope["path"] and exposes the mount as root_path), so match the service
        # segment anywhere in the path rather than as a strict prefix.
        path = scope.get("path", "")
        if "/protocollab.v1.BoardService" in path:
            await self._board(scope, receive, send)
        else:
            await self._greet(scope, receive, send)


rpc_app = _RpcRouter()
