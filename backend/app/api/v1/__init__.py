"""Aggregation of REST v1 routers."""

from fastapi import APIRouter

from app.api.v1 import auth, boards, comments, tags, tasks
from app.realtime.router import router as realtime_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(boards.router)
api_router.include_router(tasks.router)
api_router.include_router(comments.router)
api_router.include_router(tags.router)
api_router.include_router(realtime_router)
