"""Tests for webhooks: signing/verification, endpoint CRUD, dispatch, inbox."""

import json
import time
import uuid

import pytest

from app.core.config import get_settings
from app.webhooks.security import generate_secret, sign, verify

requires_db = pytest.mark.skipif(
    get_settings().database_url is None,
    reason="DATABASE_URL not configured (e.g. CI without secrets)",
)


def test_sign_and_verify_roundtrip():
    """Pure unit test — no database, always runs."""
    secret = generate_secret()
    msg_id = str(uuid.uuid4())
    ts = int(time.time())
    body = '{"type":"x"}'
    sig = sign(secret, msg_id, ts, body)

    assert verify(secret, msg_id, str(ts), body, sig)
    assert not verify(secret, msg_id, str(ts), '{"type":"y"}', sig)  # tampered body
    assert not verify(generate_secret(), msg_id, str(ts), body, sig)  # wrong secret


@requires_db
async def test_endpoint_crud_and_test_fire(client, register):
    h = await register()

    r = await client.post(
        "/api/v1/webhooks/endpoints", json={"event_types": ["webhook.test"]}, headers=h
    )
    assert r.status_code == 201
    ep = r.json()
    assert ep["secret"].startswith("whsec_")
    assert ep["url"].endswith(f"/inbox/{ep['id']}")

    r = await client.get("/api/v1/webhooks/endpoints", headers=h)
    assert any(e["id"] == ep["id"] for e in r.json())

    # Firing the test event must create a delivery row for the subscribed endpoint.
    r = await client.post("/api/v1/webhooks/test", headers=h)
    assert r.status_code == 202
    r = await client.get("/api/v1/webhooks/deliveries", headers=h)
    assert any(d["event_type"] == "webhook.test" for d in r.json())

    await client.delete(f"/api/v1/webhooks/endpoints/{ep['id']}", headers=h)


@requires_db
async def test_inbox_signature_verification(client, register):
    h = await register()
    r = await client.post(
        "/api/v1/webhooks/endpoints", json={"event_types": ["webhook.test"]}, headers=h
    )
    ep = r.json()
    secret, eid = ep["secret"], ep["id"]

    body = json.dumps({"type": "webhook.test", "hello": "world"})
    msg_id = str(uuid.uuid4())
    ts = int(time.time())
    good_sig = sign(secret, msg_id, ts, body)
    common = {
        "content-type": "application/json",
        "webhook-id": msg_id,
        "webhook-timestamp": str(ts),
    }
    url = f"/api/v1/webhooks/inbox/{eid}"

    r = await client.post(url, content=body, headers={**common, "webhook-signature": good_sig})
    assert r.status_code == 200

    r = await client.post(url, content=body, headers={**common, "webhook-signature": "v1,bad"})
    assert r.status_code == 200

    r = await client.get("/api/v1/webhooks/inbox", headers=h)
    latest_two = {e["signature_valid"] for e in r.json()[:2]}
    assert latest_two == {True, False}

    await client.delete(f"/api/v1/webhooks/endpoints/{eid}", headers=h)
