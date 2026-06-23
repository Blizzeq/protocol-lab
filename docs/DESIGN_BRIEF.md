# Protocol Lab - Design Brief & Claude Design Prompts

This document is the design spec for redesigning Protocol Lab's frontend into a portfolio-grade,
visually impressive experience. It is written to be **pasted, section by section, into
[claude.ai/design](https://claude.ai/design)**: each "PROMPT" block is self-contained and produces
one screen or component set. Claude Design will render working React UI; export it (public link or
ZIP) and hand it to the coding agent, which re-implements it in our Next.js app.

> **The whole app stays in English** - every label, button, and helper string below is final copy.

---

## 0. The big idea - "Watch the message move"

The original demos *work*, but several are flat (REST dumps you into raw API docs; gRPC just echoes
"hello {name}"). The redesign gives every paradigm **one shared dramatic device**:

> **You trigger a message, and you watch it travel through that protocol's own lifecycle -
> stage by stage, frame by frame - until it resolves.**

This is the single most portfolio-worthy idea, because each protocol's *personality* lives in its
lifecycle:

| Paradigm | The lifecycle you watch | Why it's interesting |
|---|---|---|
| **REST** | `Compose → Auth attached → Request in flight → Server → Response (200 / 4xx / 429)` | One round-trip; status codes; bytes; rate-limit |
| **GraphQL** | `Pick fields → Query shaped → 1 request → Resolve → Exactly your fields` | Over-fetching killed; bytes shrink as you uncheck fields |
| **Real-time** | `Connect → Handshake → OPEN → frames streaming… → reconnecting → OPEN` | A live connection state machine + frame ticker |
| **Webhooks** ★ | `Event → Queued → Signed (HMAC) → Attempt 1 → ✓ Delivered / ✗ Retry (backoff) → … → Dead-letter` | The literal "states of a sent message" - the star demo |
| **gRPC / Connect** | `Typed request → Serialize → POST /rpc → Server → Typed response` + a **server-stream** of frames | A real typed contract over board data, not a toy greeter |
| **MCP** | `Claude picks a tool → Arguments → services/ → Structured result` | Watch an AI tool-call resolve against the same data |

Everything sits on **one reusable shell** (below) so the six pages feel like one product, and the
contrast between paradigms is visible at a glance.

---

## 1. Visual language (give this to Claude Design verbatim)

> **PROMPT - design system foundation (paste this first, once):**
>
> Build a design system for a developer tool called **Protocol Lab** in a **modern terminal / "hacker
> console" aesthetic**: dark, monospace, neon accents - but clean, legible, and friendly, not
> cluttered. Use these exact tokens:
>
> - **Colors:** background `#0b0f17` (ink), panels `#111824`, insets/inputs `#0d131d`, borders
>   `#202c3e`, primary text `#d7e0ee`, muted text `#8595ab`, primary accent **neon green `#4ade80`**,
>   secondary accent **cyan `#38bdf8`**, danger `#f87171`, warning `#fbbf24`.
> - **Type:** **JetBrains Mono** everywhere (monospace). Headings can be bold; body is regular.
>   Page titles read like shell commands, e.g. `$ webhooks` or `$ grpc --stream`.
> - **Surfaces:** rounded-`lg` panels with a 1px `#202c3e` border on the panel background. Faint
>   dotted-grid texture on the page background (radial dots, ~22px grid, ~6% opacity).
> - **Buttons:** default = bordered, transparent fill, hover turns border + text neon. Primary =
>   neon-tinted fill (`#4ade80` at ~10% bg, neon border + text), hover brightens.
> - **Motifs:** a blinking block cursor `▮` in neon; `traffic-light` window dots (red/amber/green) in
>   the header; inline code in cyan; tags as small bordered pills.
> - **Motion:** subtle and purposeful - stages light up in sequence, frames slide in from the right,
>   status dots pulse. Nothing bouncy or decorative. ~150-250ms eases.
>
> Keep contrast high and spacing generous. The vibe is "a beautiful terminal", not a neon arcade.

---

## 2. Shared components (the kit every page is built from)

> **PROMPT - shared component kit (paste after the foundation):**
>
> Design these reusable components in the Protocol Lab terminal style. They are the building blocks
> for six demo pages.
>
> 1. **PageHeader** - a breadcrumb link `$ cd ..`, a shell-style title (`$ <command>`), a one-line
>    subtitle in muted text, and a blinking neon cursor after the title.
> 2. **StepList** - a numbered "how to use" list inside a panel, heading `# steps`, each step short;
>    keywords highlighted in neon. (Every page has this - it's what makes the demo self-explanatory.)
> 3. **Playground shell** - the core layout: a responsive 3-zone board -
>    **left = Trigger/Compose**, **center = The Wire** (the star), **right = Result**. On mobile they
>    stack. Each zone is a panel with a tiny monospace caption (`// trigger`, `// the wire`,
>    `// result`).
> 4. **StagePipeline** - a horizontal row of named stages (e.g. `Queued → Signed → Delivering →
>    Delivered`) connected by thin lines. States: `idle` (muted), `active` (neon, pulsing), `done`
>    (neon, solid check), `error` (red, ✗). The active stage animates; completed stages stay lit. This
>    is the heart of "watch the message move."
> 5. **FrameTicker** - a vertical stream where each incoming item ("frame") slides in from the top
>    with a timestamp, a type tag, and a compact payload. Newest on top, capped list, smooth.
> 6. **StatusBadge** - a small pill: green `200 OK` / `valid` / `delivered`, amber `retrying` /
>    `connecting`, red `4xx` / `invalid` / `dead-letter`. Optional leading dot that pulses when active.
> 7. **ConnectionBadge** - a dot + label for live connections: `connecting` (amber, pulsing) → `open`
>    (neon, steady) → `reconnecting` (amber, pulsing) → `closed` (muted).
> 8. **MetricStat** - a big number + small label, used for "bytes", "latency ms", "attempts",
>    "frames". Two or three can sit in a row; support a "vs" comparison (e.g. `512 B` warn vs `48 B`
>    neon with a "10.6× smaller" caption).
> 9. **JsonView** - a syntax-highlighted, scrollable JSON/code block on the inset background, with a
>    copy button and a byte/line count in the corner.
> 10. **CodeBlock** - like JsonView but for snippets (`.proto`, shell commands, TS signatures), with a
>     language tag and copy button.
> 11. **AuthBar** - a compact inline sign-in/up strip (email + password, or "signed in as …" +
>     sign-out) used at the top of pages that need auth. Unobtrusive, single row.
>
> Make StagePipeline, FrameTicker, and StatusBadge especially polished - they carry the whole concept.

---

## 3. Page-by-page prompts

Each block below is one screen. Paste it into Claude Design **after** the foundation + kit prompts so
it reuses the same components and tokens.

### 3.1 Home / landing

> **PROMPT - Home page:**
>
> Design the Protocol Lab landing page in the terminal style. Top: a shell prompt line
> `protocol-lab:~$ ./run --all-paradigms`, then a bold title **Protocol Lab** with a blinking neon
> cursor, then a one-paragraph subtitle: "One dataset - a collaborative task board - exposed through
> every modern data-exchange paradigm: REST, GraphQL, WebSocket/SSE, webhooks, gRPC and MCP."
>
> Below that, a **"# get started in 3 steps"** panel containing an inline AuthBar (sign up with any
> email + 8-char password) and a **Create sample data** primary button.
>
> Then a heading `// the six paradigms` and a responsive 2-column grid of six cards. Each card: the
> paradigm name (bold), a status tag (`✓ M1`…`✓ M6`) in neon, a one-line blurb, and a `$ open →` link
> in cyan. Cards lift / border-glow neon on hover. The six:
> - **REST** - "The foundation - CRUD over HTTP, OpenAPI, pagination, auth"
> - **GraphQL** - "Ask for exactly the fields you want - nothing more"
> - **WebSocket + SSE** - "Real-time - the server pushes changes as they happen"
> - **Webhooks** - "Events delivered to your URL, signed and retried"
> - **gRPC / Connect** - "A typed contract, called straight from the browser"
> - **MCP** - "Expose the same data to AI models like Claude"
>
> Add a slim sticky header (traffic-light dots, `protocol-lab:~$`, a `github ↗` link on the right) and
> a thin footer line `// protocol-lab - REST · GraphQL · WebSocket/SSE · webhooks · gRPC · MCP`.

### 3.2 REST - guided request playground (fixes the "I don't know what to click" problem)

> **PROMPT - REST playground:**
>
> Design a **guided REST request playground** (NOT raw API docs). PageHeader: `$ rest --crud-over-http`,
> subtitle "Build a request, send it, and watch one round-trip resolve - status, timing, size and all."
> StepList: 1) Sign in. 2) Pick a preset request. 3) Hit Send and watch the lifecycle. 4) Try the
> "Create" preset to see a 201, or spam Send to trip the 429 rate-limit.
>
> Use the **Playground shell**:
> - **Trigger (left):** a list of **preset request buttons** (so the user is never lost):
>   `GET /boards`, `GET /boards/{id}/tasks`, `POST /boards/{id}/tasks` (create), `GET /tasks?status=done`
>   (filter), and a deliberately bad one `GET /boards/nope` (→ 404 problem+json). Show the chosen
>   request as a method pill + path. For POST, show a tiny editable JSON body. A neon **Send** button.
> - **The Wire (center):** a **StagePipeline**: `Compose → Auth header attached → Request in flight →
>   Server processing → Response`. As Send runs, stages light up in sequence; the final stage shows a
>   StatusBadge (`200 OK` green, `201 Created` green, `404` / `422` red, `429 Too Many Requests` amber).
>   Below the pipeline: MetricStats for **latency (ms)**, **response size (bytes)**, and **status code**.
> - **Result (right):** the response in a **JsonView** with a copy button; a collapsible "response
>   headers" section; for errors, render the RFC 9457 problem+json shape with a red accent so the
>   structured-error format is visible.
>
> Add a small footer link row: `open full API reference (Scalar) ↗` and `open /docs ↗` - secondary,
> for power users, so the guided playground is clearly the main path.

### 3.3 GraphQL - field picker vs REST over-fetching

> **PROMPT - GraphQL vs REST:**
>
> Design a **side-by-side over-fetching demo**. PageHeader: `$ graphql --pick-your-fields`, subtitle
> "REST returns whole objects; GraphQL returns exactly the fields you tick. Watch the payload shrink."
> StepList: 1) Sign in & ensure sample data. 2) Tick/untick fields. 3) Compare - REST always sends
> everything, GraphQL sends only your selection.
>
> Layout: a **field picker** at top - checkboxes for task fields: `id`, `title`, `status`,
> `description`, `priority`, `tags`, `comments`, `created_at`, `updated_at`. As the user toggles
> fields, a live **GraphQL query** updates in a CodeBlock (e.g. `query { board(id){ tasks { id title
> } } }`).
>
> Then two panels side by side, each a JsonView:
> - **left = REST** (`GET /boards/{id}/tasks`) - always the full objects, byte count in warn color.
> - **right = GraphQL** - only the ticked fields, byte count in neon.
>
> Between/above them, a prominent **MetricStat comparison**: `REST 512 B` vs `GraphQL 48 B` with a
> caption "REST is 10.6× larger for the same data" - the multiplier recomputes as fields toggle. A
> **Compare** button runs both. Add secondary links: `open GraphiQL ↗`. Optional: a small
> "Subscriptions" tab showing a live subscription pushing new tasks into a FrameTicker.

### 3.4 Real-time - connection state machine + live frames

> **PROMPT - Real-time (SSE + WebSocket):**
>
> Design a **real-time streaming** page. PageHeader: `$ realtime --sse --ws`, subtitle "The server
> pushes board activity to the browser. Watch frames arrive live - and watch the connection heal
> itself." StepList: 1) The feed is already live (no sign-in to watch). 2) Sign in and Generate an
> event - it appears instantly. 3) Open a second tab - both update at once.
>
> Top strip: a **ConnectionBadge** (`connecting → open → reconnecting → closed`) plus a "frames
> received" counter and a **Generate an event** neon button. Add a playful **Drop connection** button
> that forces a reconnect so the state machine animates `open → reconnecting → open`.
>
> Main area, two panels:
> - **left = live frame feed:** a **FrameTicker** - each event slides in from the top with a timestamp,
>   a neon type tag (`task.created`, `board.created`, `client.message`…), and a compact payload.
> - **right = events over time:** a small live line/area chart (neon line on the dark grid) counting
>   events as they arrive.
>
> Below, a **WebSocket panel** ("bidirectional"): a Connect button + ConnectionBadge, a message input
> and Send button; explain that the sent message is broadcast back through the same bus and appears in
> the feed above as a `client.message` frame. Toggle chips at top: **SSE | WebSocket** to show both
> transports feed the same UI.

### 3.5 Webhooks ★ - the delivery state machine (the star demo)

> **PROMPT - Webhooks inspector (flagship):**
>
> Design the **flagship** page: a webhook **delivery state machine** visualizer. PageHeader:
> `$ webhooks --signed --retried`, subtitle "Fire an event and watch each delivery move through its
> full lifecycle - queued, signed, attempted, retried with backoff, delivered or dead-lettered."
> StepList: 1) Sign in. 2) Create an endpoint (points at this app's own inbox - no setup). 3) Fire an
> event. 4) Watch the delivery travel its state machine, signature verified live.
>
> This page's centerpiece is a **per-delivery StagePipeline** that animates:
> `Event fired → Queued → Signed (HMAC-SHA256) → Attempt #1 → [✓ 2xx Delivered]` - and for a
> deliberately failing endpoint: `Attempt #1 ✗ 5xx → wait (backoff 1s) → Attempt #2 ✗ → wait (4s) →
> Attempt #3 ✗ → Dead-letter`. Each attempt is a node on a timeline with its response code, the
> backoff delay between them shown as a labeled gap, and a final StatusBadge.
>
> Layout (Playground shell):
> - **Trigger (left):** event-type checkboxes (`webhook.test`, `task.created`, `task.updated`,
>   `task.deleted`, `board.created`); a **Create endpoint** button (with a toggle "make it fail
>   sometimes" to demo retries + dead-letter); the one-time **signing secret** revealed in a warning-
>   colored box (`whsec_…`); a **Fire event** primary button; a list of your endpoints with delete.
> - **The Wire (center):** the animated StagePipeline + attempt timeline described above, for the most
>   recent delivery. A **Replay** button re-sends a past delivery.
> - **Result / Inspector (right):** a **live inspector** (mini webhook.site) - a FrameTicker of
>   *received* deliveries, each with a green **valid** / red **invalid** signature StatusBadge, the
>   event type, and an expandable raw payload + the `webhook-id / webhook-timestamp / webhook-signature`
>   headers. Below it, a "recent deliveries" table: event · status · attempts · last code.
>
> Make the retry/backoff/dead-letter animation genuinely satisfying - this is the demo that sells the
> portfolio.

### 3.6 gRPC / Connect - typed contract over real data (replaces "hello {name}")

> **PROMPT - gRPC / Connect:**
>
> Design a **typed-RPC** page that shows a *real* contract over the task-board data (not a toy
> greeter). PageHeader: `$ grpc --via connect`, subtitle "A typed Protobuf contract, generated into a
> Python server and a TypeScript client by buf. The browser calls it directly over Connect - no proxy."
> StepList: 1) Read the .proto contract. 2) Run a unary call and watch it serialize → POST → resolve.
> 3) Start a server-stream and watch typed frames arrive. 4) Open DevTools → Network to see a readable
> POST.
>
> Three regions:
> - **The contract:** a CodeBlock showing a `.proto` with a real service, e.g.
>   `service BoardService { rpc GetBoardStats(BoardStatsRequest) returns (BoardStatsResponse);
>   rpc WatchBoard(WatchRequest) returns (stream BoardEvent); }` plus the message definitions, and
>   beside it the **generated TypeScript signature** (so the codegen pipeline proto→types is visible).
> - **Unary call (GetBoardStats):** a board picker + neon **call BoardService.getBoardStats()** button.
>   A **StagePipeline**: `Typed request → Serialize → POST /rpc → Server → Typed response`. Result =
>   a JsonView of typed stats (counts by status, totals) + MetricStats (latency, payload bytes). A
>   small **wire format** toggle: `JSON | binary protobuf` with a note that the binary form is smaller.
> - **Server stream (WatchBoard):** a **Start stream** button → a ConnectionBadge + a FrameTicker of
>   typed `BoardEvent` frames arriving one by one (each typed, with a sequence number), and a **Stop**
>   button. This is the "wow" - a typed stream straight to the browser.
>
> Add a one-line callout: "Same contract, three call styles: unary, server-streaming - all natively in
> the browser, no Envoy/grpc-web proxy."

### 3.7 MCP - AI tool playground

> **PROMPT - MCP (Connect to Claude):**
>
> Design an **MCP tool playground**. PageHeader: `$ mcp --connect claude`, subtitle "Expose the same
> task-board data to AI models as a small set of curated tools - over the same services/ layer as REST
> and GraphQL." StepList: 1) Sign in & create an API key. 2) Try a tool right here in the browser. 3)
> Copy the connect snippet into Claude Code or Claude Desktop.
>
> Two halves:
> - **Try a tool (interactive):** a list of the curated tools as selectable cards - `whoami`,
>   `list_boards`, `list_tasks`, `search_tasks`, `create_task` - each with a one-line description and
>   its argument fields. Pick a tool, fill args, hit **Invoke**. A **StagePipeline**:
>   `Claude picks tool → Arguments → services/ → Structured result`. Result = a JsonView of exactly the
>   structured payload the model would receive. (Frames the AI tool-call as a lifecycle, like the
>   others.)
> - **Connect for real:** an ApiKeyMaker (sign in → create key `pl_…`), then CodeBlocks:
>   - Claude Code (remote): `claude mcp add --transport http protocol-lab <API>/mcp`
>   - Claude Desktop: note "Settings → Connectors → Add custom connector → URL `<API>/mcp`".
>   - Local (stdio): `claude mcp add protocol-lab -e MCP_API_KEY=pl_xxx -- uv run fastmcp run app/mcp_server.py`
>   Close with: "Because tools call the shared service layer, a task Claude creates shows up live on the
>   real-time feed and fires webhooks."

---

## 4. Notes for the coding agent (implementation deltas, after design is approved)

These are the only places the redesign needs **new backend**; the rest is pure frontend reskin onto
existing endpoints.

- **gRPC:** the new demo needs real RPCs. Add to `proto/protocollab/v1/` a `BoardService` with
  `GetBoardStats` (unary) and `WatchBoard` (server-streaming `BoardEvent`, fed from the existing
  `EventBus`). Regenerate with `buf generate`; implement in `app/rpc/` over the shared `services/`.
  Keep `GreetService` or drop it.
- **MCP in-browser "Invoke":** the page calls existing REST/`services` endpoints to mirror what each
  tool returns (we don't expose the MCP transport to the browser directly) - `whoami`→`/auth/me`,
  `list_boards`→`/boards`, etc. Pure frontend; no backend change.
- **Webhooks "make it fail" toggle:** add an inbox route that returns 5xx on demand (or a per-endpoint
  flag) so the retry → dead-letter animation has real data to show.
- **REST/GraphQL/Real-time:** no backend change - they already expose everything the new UIs need.
- Everything stays behind the existing **shared `services/` layer** - that architectural pillar is
  unchanged.

## 5. How to drive Claude Design (workflow)

1. Open [claude.ai/design](https://claude.ai/design), start a project.
2. Paste **§1 (foundation)**, then **§2 (component kit)** - let it build the system.
3. Paste each **§3 page prompt** one at a time; iterate in the design tool until each screen looks
   great.
4. **Export** → copy the public link (or download the ZIP) → paste it back to the coding agent.
5. The coding agent re-implements the exported designs 1:1 in Next.js, wires them to the live backend,
   and verifies each in the browser preview.
