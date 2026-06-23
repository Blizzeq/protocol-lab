"""REST integration tests - require a working database (DATABASE_URL).

Shared fixtures (client, register, cleanup_emails) live in conftest.py.
In CI without secrets the tests are skipped.
"""

import pytest

from app.core.config import get_settings

pytestmark = pytest.mark.skipif(
    get_settings().database_url is None,
    reason="DATABASE_URL not configured (e.g. CI without secrets)",
)


async def test_full_board_task_comment_tag_flow(client, register):
    h = await register()

    r = await client.post("/api/v1/boards", json={"name": "Board"}, headers=h)
    assert r.status_code == 201
    bid = r.json()["id"]

    r = await client.post(
        f"/api/v1/boards/{bid}/tasks", json={"title": "Task", "priority": "high"}, headers=h
    )
    assert r.status_code == 201
    tid = r.json()["id"]
    assert r.json()["status"] == "todo"
    assert r.json()["priority"] == "high"

    r = await client.get(f"/api/v1/boards/{bid}/tasks", headers=h)
    body = r.json()
    assert body["total"] == 1 and "items" in body and "pages" in body

    r = await client.patch(f"/api/v1/tasks/{tid}", json={"status": "done"}, headers=h)
    assert r.json()["status"] == "done"

    r = await client.post(f"/api/v1/tasks/{tid}/comments", json={"body": "hej"}, headers=h)
    assert r.status_code == 201

    r = await client.post(
        f"/api/v1/boards/{bid}/tags", json={"name": "pilne", "color": "#ff0000"}, headers=h
    )
    assert r.status_code == 201
    tag_id = r.json()["id"]
    r = await client.put(f"/api/v1/tasks/{tid}/tags/{tag_id}", headers=h)
    assert r.status_code == 204
    r = await client.get(f"/api/v1/tasks/{tid}/tags", headers=h)
    assert [t["name"] for t in r.json()] == ["pilne"]


async def test_auth_required_returns_problem_json(client):
    r = await client.get("/api/v1/boards")
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["status"] == 401 and body["title"] == "Unauthorized"


async def test_validation_error_returns_problem_json(client):
    r = await client.post("/api/v1/auth/register", json={"email": "zlemail", "password": "x"})
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    assert "errors" in r.json()


async def test_ownership_isolation(client, register):
    h1 = await register()
    h2 = await register()
    r = await client.post("/api/v1/boards", json={"name": "sekret"}, headers=h1)
    bid = r.json()["id"]
    r = await client.get(f"/api/v1/boards/{bid}", headers=h2)
    assert r.status_code == 403


async def test_api_key_auth(client, register):
    h = await register()
    r = await client.post("/api/v1/auth/api-keys", json={"name": "test"}, headers=h)
    assert r.status_code == 201
    api_key = r.json()["api_key"]
    r = await client.get("/api/v1/auth/me", headers={"X-API-Key": api_key})
    assert r.status_code == 200
