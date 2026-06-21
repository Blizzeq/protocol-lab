"""Testy integracyjne REST — wymagają działającej bazy (DATABASE_URL).

W CI bez sekretów są pomijane. Dane testowe są sprzątane po każdym teście
(usunięcie użytkownika kaskaduje na tablice/zadania/komentarze/tagi/klucze).
"""

import uuid

import httpx
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_sessionmaker
from app.main import app

pytestmark = pytest.mark.skipif(
    get_settings().database_url is None,
    reason="DATABASE_URL nie skonfigurowane (np. CI bez sekretów)",
)

PASSWORD = "supersecret123"


@pytest.fixture
async def cleanup_emails():
    emails: list[str] = []
    yield emails
    sm = get_sessionmaker()
    async with sm() as db:
        for email in emails:
            await db.execute(
                text("delete from protocol_lab.users where email = :e"), {"e": email}
            )
        await db.commit()


@pytest.fixture
async def client():
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 1234))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


async def _register_and_auth(client: httpx.AsyncClient, cleanup_emails: list[str]) -> dict:
    email = f"pytest_{uuid.uuid4().hex[:10]}@protocollab.io"
    cleanup_emails.append(email)
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "PyTest"},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/v1/auth/token", data={"username": email, "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def test_full_board_task_comment_tag_flow(client, cleanup_emails):
    h = await _register_and_auth(client, cleanup_emails)

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

    # paginowana lista
    r = await client.get(f"/api/v1/boards/{bid}/tasks", headers=h)
    body = r.json()
    assert body["total"] == 1 and "items" in body and "pages" in body

    # aktualizacja statusu
    r = await client.patch(f"/api/v1/tasks/{tid}", json={"status": "done"}, headers=h)
    assert r.json()["status"] == "done"

    # komentarz
    r = await client.post(f"/api/v1/tasks/{tid}/comments", json={"body": "hej"}, headers=h)
    assert r.status_code == 201

    # tag + przypisanie
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


async def test_ownership_isolation(client, cleanup_emails):
    h1 = await _register_and_auth(client, cleanup_emails)
    h2 = await _register_and_auth(client, cleanup_emails)
    r = await client.post("/api/v1/boards", json={"name": "sekret"}, headers=h1)
    bid = r.json()["id"]
    # drugi użytkownik nie ma dostępu do cudzej tablicy
    r = await client.get(f"/api/v1/boards/{bid}", headers=h2)
    assert r.status_code == 403


async def test_api_key_auth(client, cleanup_emails):
    h = await _register_and_auth(client, cleanup_emails)
    r = await client.post("/api/v1/auth/api-keys", json={"name": "test"}, headers=h)
    assert r.status_code == 201
    api_key = r.json()["api_key"]
    r = await client.get("/api/v1/auth/me", headers={"X-API-Key": api_key})
    assert r.status_code == 200
