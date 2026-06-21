"""Webhook service: endpoint management, delivery log, inbox. Shared layer."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhooks import WebhookDelivery, WebhookEndpoint, WebhookInbox
from app.services.exceptions import NotFoundError
from app.webhooks.security import generate_secret


async def create_endpoint(
    db: AsyncSession,
    *,
    endpoint_id: uuid.UUID,
    owner_id: uuid.UUID,
    url: str,
    event_types: list[str],
    description: str | None,
) -> tuple[WebhookEndpoint, str]:
    secret = generate_secret()
    endpoint = WebhookEndpoint(
        id=endpoint_id,
        owner_id=owner_id,
        url=url,
        secret=secret,
        event_types=event_types,
        description=description,
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)
    return endpoint, secret


async def list_endpoints(db: AsyncSession, *, owner_id: uuid.UUID) -> list[WebhookEndpoint]:
    return list(
        await db.scalars(
            select(WebhookEndpoint)
            .where(WebhookEndpoint.owner_id == owner_id)
            .order_by(WebhookEndpoint.created_at.desc())
        )
    )


async def get_owned_endpoint(
    db: AsyncSession, *, owner_id: uuid.UUID, endpoint_id: uuid.UUID
) -> WebhookEndpoint:
    endpoint = await db.get(WebhookEndpoint, endpoint_id)
    if endpoint is None or endpoint.owner_id != owner_id:
        raise NotFoundError("Webhook endpoint not found.")
    return endpoint


async def delete_endpoint(db: AsyncSession, *, endpoint: WebhookEndpoint) -> None:
    await db.delete(endpoint)
    await db.commit()


async def list_deliveries(
    db: AsyncSession, *, owner_id: uuid.UUID, limit: int = 50
) -> list[WebhookDelivery]:
    stmt = (
        select(WebhookDelivery)
        .join(WebhookEndpoint, WebhookEndpoint.id == WebhookDelivery.endpoint_id)
        .where(WebhookEndpoint.owner_id == owner_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(limit)
    )
    return list(await db.scalars(stmt))


async def list_inbox(
    db: AsyncSession, *, owner_id: uuid.UUID, limit: int = 50
) -> list[WebhookInbox]:
    stmt = (
        select(WebhookInbox)
        .join(WebhookEndpoint, WebhookEndpoint.id == WebhookInbox.endpoint_id)
        .where(WebhookEndpoint.owner_id == owner_id)
        .order_by(WebhookInbox.received_at.desc())
        .limit(limit)
    )
    return list(await db.scalars(stmt))


async def record_inbox(
    db: AsyncSession,
    *,
    endpoint_id: uuid.UUID | None,
    event_type: str | None,
    headers: dict,
    body: str,
    signature_valid: bool,
) -> WebhookInbox:
    entry = WebhookInbox(
        endpoint_id=endpoint_id,
        event_type=event_type,
        headers=headers,
        body=body,
        signature_valid=signature_valid,
    )
    db.add(entry)
    await db.commit()
    return entry
