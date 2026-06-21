"""Wspólne fixture dla testów integracyjnych (REST + GraphQL)."""

import uuid

import httpx
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import text

from app.db.session import get_sessionmaker
from app.main import app

PASSWORD = "supersecret123"


@pytest.fixture
async def cleanup_emails():
    """Zbiera e-maile utworzonych userów i usuwa ich po teście (kaskada czyści resztę)."""
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


@pytest.fixture
def register(client, cleanup_emails):
    """Zwraca async-fabrykę: rejestruje nowego usera i zwraca nagłówek Authorization."""

    async def _register() -> dict[str, str]:
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

    return _register
