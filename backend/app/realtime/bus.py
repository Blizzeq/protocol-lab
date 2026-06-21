"""In-process async event bus (pub/sub) for real-time fan-out.

Single-instance only. For multi-instance deployments, back this with Redis pub/sub
(each worker subscribes to a Redis channel and relays to its local subscribers) —
the public interface (publish / subscribe) stays the same.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    async def publish(self, event: dict) -> None:
        # Fan out to every subscriber. Drop on a full queue (slow consumer) instead
        # of blocking the publisher — bounded backpressure.
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    @asynccontextmanager
    async def subscribe(self, maxsize: int = 100) -> AsyncIterator[asyncio.Queue]:
        queue: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


bus = EventBus()
