"""Domain exceptions — independent of HTTP.

Mapped to RFC 9457 responses in `app/core/errors.py`. This way the service
layer knows nothing about HTTP and can be reused by GraphQL/MCP.
"""

from __future__ import annotations


class ServiceError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class NotFoundError(ServiceError):
    """Resource does not exist → 404."""


class ConflictError(ServiceError):
    """State conflict (e.g. duplicate) → 409."""


class PermissionDeniedError(ServiceError):
    """No permission to access the resource → 403."""


class AuthenticationError(ServiceError):
    """Missing/invalid authentication → 401."""
