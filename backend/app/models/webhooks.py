"""ORM models for outgoing webhooks (mapping of the `protocol_lab` webhook tables)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String)
    secret: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    # ARRAY(Text) to match the text[] DB column (so `@>` casts to text[], not varchar[])
    event_types: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    is_active: Mapped[bool] = mapped_column(server_default=func.true())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    endpoint_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE")
    )
    event_type: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String, server_default="pending")
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    last_response_code: Mapped[int | None] = mapped_column(Integer)
    last_error: Mapped[str | None] = mapped_column(Text)
    next_retry_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class WebhookInbox(Base):
    __tablename__ = "webhook_inbox"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    endpoint_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("webhook_endpoints.id", ondelete="SET NULL")
    )
    event_type: Mapped[str | None] = mapped_column(String)
    headers: Mapped[dict] = mapped_column(JSONB)
    body: Mapped[str] = mapped_column(Text)
    signature_valid: Mapped[bool] = mapped_column()
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
