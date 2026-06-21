"""Bezpieczeństwo: hashowanie haseł, tokeny JWT, klucze API."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import get_settings

# Jawnie bcrypt (zainstalowane przez pwdlib[bcrypt]); recommended() chciałby argon2.
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
    """Zwraca `sub` (id użytkownika) lub None gdy token niepoprawny/wygasły."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


# --- Klucze API ---
API_KEY_PREFIX = "pl_"


def generate_api_key() -> tuple[str, str, str]:
    """Zwraca (pełny_klucz, prefix_do_wyświetlenia, hash_do_zapisu).

    Pełny klucz pokazujemy użytkownikowi tylko raz; w bazie trzymamy wyłącznie hash.
    """
    full = f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    return full, full[:10], hash_api_key(full)


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()
