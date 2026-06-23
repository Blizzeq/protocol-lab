"""Tests for the real-time event bus and event emission."""

import asyncio

import pytest

from app.core.config import get_settings
from app.realtime.bus import EventBus
from app.realtime.bus import bus as global_bus

requires_db = pytest.mark.skipif(
    get_settings().database_url is None,
    reason="DATABASE_URL not configured (e.g. CI without secrets)",
)


async def test_event_bus_publish_subscribe():
    """Pure unit test - no database, always runs (incl. CI)."""
    eb = EventBus()
    async with eb.subscribe() as queue:
        await eb.publish({"type": "ping"})
        event = await asyncio.wait_for(queue.get(), timeout=1)
        assert event == {"type": "ping"}
    assert eb.subscriber_count == 0


@requires_db
async def test_task_creation_emits_event(client, register):
    h = await register()
    r = await client.post("/api/v1/boards", json={"name": "B"}, headers=h)
    bid = r.json()["id"]

    async with global_bus.subscribe() as queue:
        r = await client.post(f"/api/v1/boards/{bid}/tasks", json={"title": "T"}, headers=h)
        assert r.status_code == 201
        event = await asyncio.wait_for(queue.get(), timeout=3)

    assert event["type"] == "task.created"
    assert event["payload"]["title"] == "T"
    assert event["board_id"] == bid
