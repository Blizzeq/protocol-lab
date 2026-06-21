"""Wyjątki domenowe — niezależne od HTTP.

Mapowane na odpowiedzi RFC 9457 w `app/core/errors.py`. Dzięki temu warstwa
serwisowa nie wie nic o HTTP i może być reużyta przez GraphQL/MCP.
"""

from __future__ import annotations


class ServiceError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class NotFoundError(ServiceError):
    """Zasób nie istnieje → 404."""


class ConflictError(ServiceError):
    """Konflikt stanu (np. duplikat) → 409."""


class PermissionDeniedError(ServiceError):
    """Brak uprawnień do zasobu → 403."""


class AuthenticationError(ServiceError):
    """Brak/niepoprawne uwierzytelnienie → 401."""
