"""Wspólne schematy odpowiedzi."""

from pydantic import BaseModel


class Problem(BaseModel):
    """Błąd w formacie RFC 9457 (application/problem+json)."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
