"""Consistent error handling in RFC 9457 format (application/problem+json)."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ServiceError,
)

PROBLEM_MEDIA_TYPE = "application/problem+json"


def _problem(
    status_code: int,
    title: str,
    *,
    detail: str | None = None,
    instance: str | None = None,
    headers: dict[str, str] | None = None,
    **extra: object,
) -> JSONResponse:
    body: dict[str, object] = {
        "type": "about:blank",
        "title": title,
        "status": status_code,
    }
    if detail is not None:
        body["detail"] = detail
    if instance is not None:
        body["instance"] = instance
    body.update(extra)
    return JSONResponse(
        status_code=status_code, content=body, media_type=PROBLEM_MEDIA_TYPE, headers=headers
    )


# (domain exception type, HTTP code, title)
_DOMAIN_MAP: list[tuple[type[ServiceError], int, str]] = [
    (NotFoundError, 404, "Not Found"),
    (ConflictError, 409, "Conflict"),
    (PermissionDeniedError, 403, "Forbidden"),
    (AuthenticationError, 401, "Unauthorized"),
]


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def _service_error(request: Request, exc: ServiceError) -> JSONResponse:
        for exc_type, code, title in _DOMAIN_MAP:
            if isinstance(exc, exc_type):
                headers = {"WWW-Authenticate": "Bearer"} if code == 401 else None
                return _problem(
                    code, title, detail=exc.detail, instance=request.url.path, headers=headers
                )
        return _problem(400, "Bad Request", detail=exc.detail, instance=request.url.path)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return _problem(
            422,
            "Validation Error",
            detail="The request failed validation.",
            instance=request.url.path,
            errors=jsonable_encoder(exc.errors()),
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return _problem(
            429,
            "Too Many Requests",
            detail=f"Too many requests ({exc.detail}).",
            instance=request.url.path,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _problem(
            exc.status_code,
            str(exc.detail),
            instance=request.url.path,
            headers=getattr(exc, "headers", None),
        )
