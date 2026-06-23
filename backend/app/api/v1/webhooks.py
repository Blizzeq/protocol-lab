"""Webhooks router: endpoint management, in-app receiver inbox, test fire."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.task_board import User
from app.models.webhooks import WebhookEndpoint
from app.realtime.events import emit
from app.schemas.webhook import (
    DeliveryRead,
    EndpointCreate,
    EndpointCreated,
    EndpointRead,
    InboxRead,
)
from app.services import webhooks as webhook_service
from app.webhooks.dispatch import publish_event
from app.webhooks.security import verify

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/endpoints", response_model=EndpointCreated, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: EndpointCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EndpointCreated:
    endpoint_id = uuid.uuid4()
    base = str(request.base_url).rstrip("/")
    url = payload.url or f"{base}/api/v1/webhooks/inbox/{endpoint_id}"
    endpoint, secret = await webhook_service.create_endpoint(
        db,
        endpoint_id=endpoint_id,
        owner_id=user.id,
        url=url,
        event_types=payload.event_types,
        description=payload.description,
    )
    return EndpointCreated(**EndpointRead.model_validate(endpoint).model_dump(), secret=secret)


@router.get("/endpoints", response_model=list[EndpointRead])
async def list_endpoints(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list:
    return await webhook_service.list_endpoints(db, owner_id=user.id)


@router.delete("/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    endpoint_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    endpoint = await webhook_service.get_owned_endpoint(
        db, owner_id=user.id, endpoint_id=endpoint_id
    )
    await webhook_service.delete_endpoint(db, endpoint=endpoint)


@router.get("/deliveries", response_model=list[DeliveryRead])
async def list_deliveries(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list:
    return await webhook_service.list_deliveries(db, owner_id=user.id)


@router.get("/inbox", response_model=list[InboxRead])
async def list_inbox(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list:
    return await webhook_service.list_inbox(db, owner_id=user.id)


@router.post("/test", status_code=status.HTTP_202_ACCEPTED)
async def fire_test_event(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    await publish_event(
        db,
        "webhook.test",
        board_id=None,
        payload={"message": "Hello from Protocol Lab", "ts": datetime.now(UTC).isoformat()},
    )
    return {"status": "queued"}


# --- Public receiver (no auth): the in-app "mini webhook.site" ---


@router.post("/inbox/{endpoint_id}")
async def inbox(
    endpoint_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    raw = await request.body()
    body = raw.decode("utf-8", errors="replace")
    headers = {k.lower(): v for k, v in request.headers.items()}

    endpoint = await db.get(WebhookEndpoint, endpoint_id)
    valid = False
    if endpoint is not None:
        valid = verify(
            endpoint.secret,
            headers.get("webhook-id", ""),
            headers.get("webhook-timestamp", ""),
            body,
            headers.get("webhook-signature", ""),
        )

    event_type = None
    try:
        event_type = json.loads(body).get("type")
    except (ValueError, AttributeError):
        pass

    await webhook_service.record_inbox(
        db,
        endpoint_id=endpoint_id if endpoint is not None else None,
        event_type=event_type,
        headers=headers,
        body=body,
        signature_valid=valid,
    )
    await emit(
        "webhook.received",
        board_id=None,
        payload={
            "endpoint_id": str(endpoint_id),
            "event_type": event_type,
            "signature_valid": valid,
        },
    )
    return {"ok": True}


@router.post("/sink/fail")
async def sink_fail() -> Response:
    """Always returns 500 - point an endpoint here to watch retries and dead-lettering."""
    return Response(status_code=500, content="intentional failure")
