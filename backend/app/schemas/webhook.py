"""Pydantic schemas for webhooks."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EndpointCreate(BaseModel):
    event_types: list[str] = Field(default_factory=list)
    url: str | None = None  # defaults to the in-app inbox if omitted
    description: str | None = None


class EndpointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    description: str | None
    event_types: list[str]
    is_active: bool
    created_at: datetime


class EndpointCreated(EndpointRead):
    # Signing secret - returned ONLY at creation time.
    secret: str


class DeliveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    endpoint_id: uuid.UUID
    event_type: str
    status: str
    attempts: int
    last_response_code: int | None
    last_error: str | None
    next_retry_at: datetime
    created_at: datetime


class InboxRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    endpoint_id: uuid.UUID | None
    event_type: str | None
    signature_valid: bool
    body: str
    received_at: datetime
