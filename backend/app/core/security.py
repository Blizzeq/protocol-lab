"""Security: password hashing, JWT tokens, API keys."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import get_settings

# Explicitly bcrypt (installed via pwdlib[bcrypt]); recommended() would want argon2.
_pwd = PasswordHash((BcryptHasher(),))


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _pwd.verify(password, hashed)


def create_access_token(subject: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Returns `sub` (user id) or None when the token is invalid/expired."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


# --- API keys ---
API_KEY_PREFIX = "pl_"


def generate_api_key() -> tuple[str, str, str]:
    """Returns (full_key, prefix_for_display, hash_to_store).

    We show the full key to the user only once; in the database we keep only the hash.
    """
    full = f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    return full, full[:10], hash_api_key(full)


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()
