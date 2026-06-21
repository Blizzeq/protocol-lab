"""Pydantic schemas for tags."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#888888", pattern=r"^#[0-9a-fA-F]{6}$")


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    name: str
    color: str
