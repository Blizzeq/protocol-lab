"""Test the MCP server tools via an in-memory FastMCP client."""

import pytest
from fastmcp import Client

from app.core.config import get_settings
from app.mcp_server import mcp

requires_db = pytest.mark.skipif(
    get_settings().database_url is None,
    reason="DATABASE_URL not configured (e.g. CI without secrets)",
)


@requires_db
async def test_mcp_tools_over_services(client, register):
    # Seed a user + board + API key through the REST API.
    h = await register()
    await client.post("/api/v1/boards", json={"name": "MCP Board"}, headers=h)
    r = await client.post("/api/v1/auth/api-keys", json={"name": "mcp"}, headers=h)
    api_key = r.json()["api_key"]

    settings = get_settings()
    settings.mcp_api_key = api_key
    try:
        async with Client(mcp) as mcp_client:
            who = await mcp_client.call_tool("whoami", {})
            assert who.data["email"]

            boards = await mcp_client.call_tool("list_boards", {})
            assert any(b["name"] == "MCP Board" for b in boards.data)
    finally:
        settings.mcp_api_key = None
