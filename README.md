# Protocol Lab

> A hobby & learning project: **one dataset, exposed through every modern API paradigm** - built to understand, hands-on, how each protocol actually works.

**🔗 Live (frontend):** **https://protocol-lab-three.vercel.app** - the full UI is browsable. The interactive demos call the FastAPI backend, which isn't publicly hosted yet (Vercel can't run it - see [Status](#status)), so on the live site they won't return data.

Most apps pick one way to move data and stop there. Protocol Lab takes the opposite approach: it serves **the same collaborative task board** through **REST, GraphQL, WebSocket/SSE, webhooks, gRPC (Connect), and MCP** - all over a single shared service layer. Because every paradigm reads and writes the *same* data, the differences between them become visible by **contrast** rather than from theory.

The guiding idea is **"watch the message move":** on every page you trigger a message and watch it travel that protocol's own lifecycle - stage by stage, frame by frame - until it resolves. A REST call is one round-trip with a status code; a webhook is queued, signed, attempted, retried with backoff, and either delivered or dead-lettered; gRPC streams typed frames; real-time never closes. Seeing those lifecycles side by side is the whole point.

This is a personal project for learning and portfolio purposes - not a production service.

## The six paradigms

| Paradigm | What it demonstrates |
|---|---|
| **REST** | The foundation - CRUD over HTTP, OpenAPI, pagination, auth (JWT + API keys), RFC 9457 problem+json errors, real rate limiting (429) |
| **GraphQL** | Ask for exactly the fields you want - a live field picker shows the payload shrink vs REST over-fetching; queries, mutations, subscriptions (Strawberry) |
| **WebSocket + SSE** | The server pushes changes as they happen - a live frame feed, a connection state machine, and self-healing reconnects |
| **Webhooks** | Outgoing events signed per the [Standard Webhooks](https://www.standardwebhooks.com/) spec (HMAC-SHA256), delivered by a durable worker with retries, exponential backoff, and dead-lettering - plus a live signature-verifying inspector |
| **gRPC / Connect** | A typed Protobuf contract called straight from the browser over [Connect](https://connectrpc.com/) (no Envoy/grpc-web proxy) - a unary call and a server-streaming call |
| **MCP** | Exposing the same data to AI models (Claude) as a small set of curated tools over the Model Context Protocol - try the tools in-browser, then connect for real |

## The architectural pillar: one shared service layer

Every paradigm - REST routers, the GraphQL schema, the MCP tools, and the Connect handlers - calls the **same functions** in `backend/app/services/`. Nothing is copy-pasted between transports, so "the same data through every protocol" holds *structurally*, not by convention. This is the most important design decision in the project and the main thing it set out to teach.

```
┌─────────── transports ───────────┐
REST   GraphQL   WS/SSE   Webhooks   gRPC/Connect   MCP
└──────────────────┬────────────────┘
            app/services/   ← shared domain logic
                   │
              Postgres (Supabase)
```

A mutation made through *any* transport (say, a task created by Claude via MCP) shows up live on the real-time feed and fires webhooks - because they all flow through the same service layer and the same in-process event bus.

## Tech stack

- **Backend** - Python 3.14 + **FastAPI** (managed with [uv](https://docs.astral.sh/uv/)), async SQLAlchemy 2.0 + asyncpg, Pydantic v2
- **GraphQL** - Strawberry (DataLoaders, subscriptions)
- **Real-time** - native SSE + WebSocket over an in-process async event bus (Redis-ready for multi-instance)
- **Webhooks** - Standard Webhooks signing + a DB-backed delivery queue (`FOR UPDATE SKIP LOCKED`, backoff, dead-letter) - no Redis required
- **gRPC** - ConnectRPC (`buf` + `connectrpc` for Python, `@connectrpc/connect-web` for the browser)
- **MCP** - FastMCP, served over Streamable HTTP
- **Frontend** - Next.js 16 (App Router) + React 19 + Tailwind v4, a terminal/neon design system (JetBrains Mono)
- **Database** - Supabase Postgres

## Repository layout

```
backend/        FastAPI app
  app/
    services/     ⭐ shared domain logic (the pillar)
    api/v1/       REST routers
    graphql/      Strawberry schema + resolvers
    realtime/     SSE + WebSocket + event bus
    webhooks/     signing, delivery worker, inspector
    rpc/          Connect server (BoardService, GreetService)
    mcp_server.py FastMCP tools
frontend/       Next.js app (one page per paradigm + a shared "lifecycle pipeline" UI)
proto/          .proto contracts (regenerated with `buf generate`)
docs/           DESIGN_BRIEF.md - the brief used to design the UI
```

## Running locally

**Backend** (needs a `backend/.env` with `DATABASE_URL` pointing at a Postgres/Supabase instance):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev                              # http://localhost:3000
```

Then open the app, sign up with any email (it's just a login - nothing is sent anywhere), click **Create sample data**, and explore each paradigm from the sidebar.

Regenerating the gRPC stubs after editing a `.proto` (requires the `buf` CLI):

```bash
buf generate                             # from the repo root
```

## Design

The frontend uses a terminal/"hacker console" aesthetic (dark + neon, monospace) with a shared lifecycle-pipeline component reused across every page. The full design brief - including the prompts used to mock it up in Claude Design - lives in [`docs/DESIGN_BRIEF.md`](docs/DESIGN_BRIEF.md).

## Status

All six paradigms are implemented end-to-end over the shared service layer, with a polished terminal UI.

The **frontend is deployed to Vercel** → **https://protocol-lab-three.vercel.app** (the UI is fully browsable). The interactive demos talk to the FastAPI backend, which Vercel can't host - it's a long-running server with WebSocket/SSE/MCP/gRPC. Hosting it on a long-running platform (e.g. Railway/Render) so the public demo works end-to-end is the next step.

---

*Built as a learning project to understand modern API protocols by building each one and watching the same data flow through all of them.*
