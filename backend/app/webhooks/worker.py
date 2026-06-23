"""Webhook delivery worker — DB-backed durable queue (no Redis needed).

Deliveries are persisted with a `next_retry_at`; this worker polls for due ones,
POSTs them with signed headers, and reschedules failures with exponential backoff
until they succeed or land in the dead-letter state.
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select

from app.db.session import get_sessionmaker
from app.models.webhooks import WebhookDelivery, WebhookEndpoint
from app.webhooks.security import sign

MAX_ATTEMPTS = 4
BACKOFF_SECONDS = [1, 2, 4]  # demo-friendly: dead-letter after ~7s of backoff (+ poll latency)
POLL_INTERVAL_SECONDS = 2
HTTP_TIMEOUT_SECONDS = 10


def _schedule_retry(delivery: WebhookDelivery, error: str) -> None:
    delivery.last_error = error
    if delivery.attempts >= MAX_ATTEMPTS:
        delivery.status = "dead"
    else:
        delay = BACKOFF_SECONDS[min(delivery.attempts - 1, len(BACKOFF_SECONDS) - 1)]
        delivery.status = "retrying"
        delivery.next_retry_at = datetime.now(UTC) + timedelta(seconds=delay)


async def _deliver(delivery: WebhookDelivery, endpoint: WebhookEndpoint) -> None:
    body = json.dumps(delivery.payload, separators=(",", ":"))
    msg_id = str(delivery.id)
    ts = int(datetime.now(UTC).timestamp())
    headers = {
        "content-type": "application/json",
        "webhook-id": msg_id,
        "webhook-timestamp": str(ts),
        "webhook-signature": sign(endpoint.secret, msg_id, ts, body),
        "idempotency-key": msg_id,
    }
    delivery.attempts += 1
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            resp = await client.post(endpoint.url, content=body, headers=headers)
        delivery.last_response_code = resp.status_code
        if 200 <= resp.status_code < 300:
            delivery.status = "success"
            delivery.delivered_at = datetime.now(UTC)
            delivery.last_error = None
        else:
            _schedule_retry(delivery, f"HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001 — any delivery failure is retryable
        delivery.last_response_code = None
        _schedule_retry(delivery, str(exc)[:500])


async def process_due_deliveries(limit: int = 20) -> None:
    sm = get_sessionmaker()
    async with sm() as db:
        now = datetime.now(UTC)
        # Claim due rows with FOR UPDATE SKIP LOCKED so the immediate-dispatch task and
        # the poller never deliver the same row twice (locks held until commit below).
        due = (
            await db.scalars(
                select(WebhookDelivery)
                .where(
                    WebhookDelivery.status.in_(["pending", "retrying"]),
                    WebhookDelivery.next_retry_at <= now,
                )
                .order_by(WebhookDelivery.created_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        ).all()
        for delivery in due:
            endpoint = await db.get(WebhookEndpoint, delivery.endpoint_id)
            if endpoint is None:
                delivery.status = "dead"
                delivery.last_error = "endpoint deleted"
                continue
            await _deliver(delivery, endpoint)
        await db.commit()


async def poller() -> None:
    while True:
        try:
            await process_due_deliveries()
        except Exception:  # noqa: BLE001 — keep the loop alive on transient errors
            pass
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
