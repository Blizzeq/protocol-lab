"""Agregacja routerów REST v1."""

from fastapi import APIRouter

from app.api.v1 import auth, boards, tasks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(boards.router)
api_router.include_router(tasks.router)
