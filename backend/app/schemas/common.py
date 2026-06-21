"""Shared response schemas."""

from pydantic import BaseModel


class Problem(BaseModel):
    """Error in RFC 9457 format (application/problem+json)."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
