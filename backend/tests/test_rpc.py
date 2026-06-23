"""Test for the Connect (gRPC) endpoint - no database, runs everywhere."""

import httpx
from asgi_lifespan import LifespanManager

from app.main import app


async def test_connect_greet_unary():
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 1234))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post(
                "/rpc/protocollab.v1.GreetService/Greet",
                json={"name": "Test"},
                headers={"connect-protocol-version": "1"},
            )
    assert r.status_code == 200
    body = r.json()
    assert body["greeting"] == "Hello, Test!"
    assert body["servedBy"]  # proto3 JSON camelCases served_by
