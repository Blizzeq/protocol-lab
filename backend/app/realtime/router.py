"""Real-time endpoints: Server-Sent Events (SSE) + WebSocket, fed by the event bus.

The stream is a public, read-only activity feed (events carry only minimal,
non-sensitive fields). Mutations still go through the authenticated REST/GraphQL APIs;
this just broadcasts what happened.
"""

from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.realtime.bus import bus
from app.realtime.events import emit

router = APIRouter(tags=["realtime"])

KEEPALIVE_SECONDS = 15


@router.get("/stream", summary="SSE stream of board activity")
async def stream(request: Request, board_id: uuid.UUID | None = None):
    async def event_generator():
        async with bus.subscribe() as queue:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                except TimeoutError:
                    yield ": keep-alive\n\n"  # comment line keeps the connection open
                    continue
                if board_id is not None and event.get("board_id") != str(board_id):
                    continue
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Bidirectional: receives events from the bus AND lets the client broadcast a message."""
    await websocket.accept()
    async with bus.subscribe() as queue:

        async def receive_loop():
            try:
                while True:
                    text = await websocket.receive_text()
                    await emit("client.message", board_id=None, payload={"text": text[:500]})
            except WebSocketDisconnect:
                pass

        receiver = asyncio.create_task(receive_loop())
        try:
            while True:
                event = await queue.get()
                await websocket.send_json(event)
        except WebSocketDisconnect:
            pass
        finally:
            receiver.cancel()
