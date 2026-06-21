"""Schematy Pydantic dla tablic (boards)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BoardBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class BoardCreate(BoardBase):
    pass


class BoardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class BoardRead(BoardBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
