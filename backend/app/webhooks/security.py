"""Webhook signing/verification per the Standard Webhooks spec.

Signature = HMAC-SHA256 over `{id}.{timestamp}.{body}`, base64-encoded, prefixed `v1,`.
Secrets are `whsec_`-prefixed base64; the HMAC key is the base64-DECODED part.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

SECRET_PREFIX = "whsec_"
DEFAULT_TOLERANCE_SECONDS = 300


def generate_secret() -> str:
    return SECRET_PREFIX + base64.b64encode(secrets.token_bytes(24)).decode()


def _key_bytes(secret: str) -> bytes:
    raw = secret.removeprefix(SECRET_PREFIX)
    return base64.b64decode(raw)


def sign(secret: str, msg_id: str, timestamp: int, body: str) -> str:
    signed = f"{msg_id}.{timestamp}.{body}".encode()
    digest = hmac.new(_key_bytes(secret), signed, hashlib.sha256).digest()
    return "v1," + base64.b64encode(digest).decode()


def verify(
    secret: str,
    msg_id: str,
    timestamp: str,
    body: str,
    signature_header: str,
    tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS,
) -> bool:
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(time.time() - ts) > tolerance_seconds:  # anti-replay
        return False
    expected = sign(secret, msg_id, ts, body).split(",", 1)[1]
    # The header may carry multiple space-delimited signatures (key rotation).
    for part in signature_header.split():
        candidate = part.split(",", 1)[1] if "," in part else part
        if hmac.compare_digest(candidate, expected):  # constant-time compare
            return True
    return False
