"""GraphQL integration tests — the same services/ layer as REST."""

import httpx
import pytest

from app.core.config import get_settings

pytestmark = pytest.mark.skipif(
    get_settings().database_url is None,
    reason="DATABASE_URL not configured (e.g. CI without secrets)",
)


async def _gql(
    client: httpx.AsyncClient,
    query: str,
    variables: dict | None = None,
    headers: dict | None = None,
) -> dict:
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables
    r = await client.post("/graphql", json=payload, headers=headers or {})
    return r.json()


async def test_graphql_mutations_and_nested_query(client, register):
    h = await register()

    data = await _gql(client, 'mutation { createBoard(name: "G") { id name } }', headers=h)
    assert "errors" not in data, data
    bid = data["data"]["createBoard"]["id"]

    data = await _gql(
        client,
        "mutation C($b: UUID!){ createTask(boardId: $b, title: \"t\"){ id status priority } }",
        {"b": bid},
        h,
    )
    assert data["data"]["createTask"]["status"] == "todo"
    assert data["data"]["createTask"]["priority"] == "medium"

    # nested tasks field resolved by DataLoader
    data = await _gql(client, "{ boards { id tasks { id title } } }", headers=h)
    boards = data["data"]["boards"]
    assert any(b["id"] == bid and len(b["tasks"]) == 1 for b in boards)


async def test_graphql_requires_auth(client):
    data = await _gql(client, "{ boards { id } }")
    assert data["data"] is None
    assert data["errors"][0]["message"].startswith("Authentication required")
