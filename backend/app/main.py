"""Punkt wejścia FastAPI — celowo cienki.

Tworzy aplikację, podpina middleware i routery. Logika domenowa żyje w
``app/services`` i jest współdzielona przez WSZYSTKIE paradygmaty (REST, GraphQL,
MCP, Connect) — to filar architektury projektu.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_pagination import add_pagination
from slowapi.middleware import SlowAPIMiddleware
from strawberry.fastapi import GraphQLRouter
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.ratelimit import limiter
from app.graphql.context import get_context
from app.graphql.schema import schema as graphql_schema

settings = get_settings()

app = FastAPI(
    title="Protocol Lab API",
    version="0.1.0",
    description=(
        "Jeden zbiór danych udostępniony przez wszystkie nowoczesne paradygmaty "
        "wymiany informacji: REST, GraphQL, gRPC/Connect, WebSocket, SSE, webhooki i MCP."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (slowapi) — limiter w app.state + middleware stosujące limity domyślne
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

register_error_handlers(app)
app.include_router(api_router)
add_pagination(app)

# GraphQL (Strawberry) — nad tą samą warstwą services/ co REST
graphql_router = GraphQLRouter(
    graphql_schema,
    context_getter=get_context,
    graphql_ide="graphiql",
    subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL, GRAPHQL_WS_PROTOCOL],
)
app.include_router(graphql_router, prefix="/graphql")


@app.get("/health", tags=["meta"], summary="Health check")
async def health() -> dict[str, str]:
    """Prosty endpoint zdrowia — używany przez load balancery i smoke testy."""
    return {"status": "ok", "service": "protocol-lab", "version": app.version}
