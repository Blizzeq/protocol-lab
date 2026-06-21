"""Publish domain events to both real-time subscribers and webhook endpoints.

Called from the shared service layer, so REST and GraphQL mutations both trigger
real-time fan-out (in-process bus) AND webhook deliveries.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhooks import WebhookDelivery, WebhookEndpoint
from app.realtime.bus import bus


async def publish_event(
    db: AsyncSession, event_type: str, *, board_id: uuid.UUID | None, payload: dict
) -> None:
    event = {
        "type": event_type,
        "board_id": str(board_id) if board_id is not None else None,
        "payload": payload,
        "ts": datetime.now(UTC).isoformat(),
    }
    await bus.publish(event)
    await dispatch_webhooks(db, event_type, event)


async def dispatch_webhooks(db: AsyncSession, event_type: str, event: dict) -> None:
    endpoints = (
        await db.scalars(
            select(WebhookEndpoint).where(
                WebhookEndpoint.is_active.is_(True),
                WebhookEndpoint.event_types.contains([event_type]),
            )
        )
    ).all()
    if not endpoints:
        return
    for endpoint in endpoints:
        db.add(WebhookDelivery(endpoint_id=endpoint.id, event_type=event_type, payload=event))
    await db.commit()
    # Kick the worker so the first attempt is prompt (non-blocking); retries via the poller.
    from app.webhooks.worker import process_due_deliveries

    asyncio.create_task(process_due_deliveries())
