"""Smoke test — confirms the application starts and /health responds.

Uses httpx.AsyncClient + ASGITransport (recommended for async FastAPI; the
synchronous TestClient can block the event loop).
"""

import httpx
import pytest
from asgi_lifespan import LifespanManager

from app.main import app


@pytest.mark.asyncio
async def test_health_ok():
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "protocol-lab"
