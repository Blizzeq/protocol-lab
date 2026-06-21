"""Domain event helpers — published to the in-process bus, consumed by SSE/WebSocket.

Called from the shared service layer, so both REST and GraphQL mutations emit events.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.realtime.bus import bus


async def emit(event_type: str, *, board_id: uuid.UUID | None, payload: dict) -> None:
    await bus.publish(
        {
            "type": event_type,
            "board_id": str(board_id) if board_id is not None else None,
            "payload": payload,
            "ts": datetime.now(UTC).isoformat(),
        }
    )
