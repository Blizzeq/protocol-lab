"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API, authHeaders, jsonHeaders } from "@/lib/api";

import { JsonView } from "../components/playground/hl";
import { StagePipeline, useStagePipeline } from "../components/playground/Pipeline";
import { Caption, PageHeader, Panel, StepList, useAuth } from "../components/playground/ui";

// ── types ───────────────────────────────────────────────────────────────────
type Endpoint = {
  id: string;
  url: string;
  event_types: string[];
  is_active: boolean;
};

type Delivery = {
  id: string;
  endpoint_id: string;
  event_type: string;
  status: "pending" | "retrying" | "success" | "dead";
  attempts: number;
  last_response_code: number | null;
  created_at: string;
};

type Received = {
  id: string;
  endpoint_id: string;
  event_type: string | null;
  signature_valid: boolean;
  ts: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  expanded: boolean;
};

const EVENT_TYPES = [
  "webhook.test",
  "task.created",
  "task.updated",
  "task.deleted",
  "board.created",
];

const WIRE_STAGES = ["Event fired", "Queued", "Signed (HMAC)", "Delivering"];
const FAIL_URL = `${API}/api/v1/webhooks/sink/fail`;

// Color for a delivery's response code in the table: 2xx → neon, else danger/muted.
function codeColor(code: number | null, status: string): string {
  if (status === "pending" || status === "retrying" || code === null) return "#8595ab";
  if (code >= 200 && code < 300) return "#4ade80";
  return "#f87171";
}

function statusColor(status: string): string {
  if (status === "success") return "#4ade80";
  if (status === "dead") return "#f87171";
  return "#8595ab";
}

// Backoff schedule mirrors the backend worker (BACKOFF_SECONDS = [1,2,4,8]).
const BACKOFF = [1, 2, 4, 8];

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// Illustrative HMAC signing demo block (matches the design prototype).
function signingHtml(eventType: string): string {
  const id = "msg_2Kdf91xQ";
  const ts = "1750669820";
  const sampleBody = JSON.stringify({ type: eventType || "webhook.test" });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return (
    `<span style="color:#8595ab">signed_content</span> = <span style="color:#38bdf8">"${esc(id)}</span><span style="color:#3f4d63">.</span><span style="color:#38bdf8">${esc(ts)}</span><span style="color:#3f4d63">.</span><span style="color:#38bdf8">${esc(truncate(sampleBody))}"</span>\n` +
    `<span style="color:#8595ab">signature</span>    = <span style="color:#4ade80">"v1,"</span> + base64( <span style="color:#4ade80">HMAC_SHA256</span>(<span style="color:#fbbf24">whsec_…</span>, signed_content) )\n` +
    `<span style="color:#3f4d63">             →</span> <span style="color:#fbbf24">v1,Gp8kQz2Xa9fL7m4hVwR1cT0bN6sE3dY=</span>`
  );
}

export default function WebhooksPage() {
  const { signedIn } = useAuth();

  // event-type checkboxes - webhook.test ON by default (so /test deliveries match).
  const [events, setEvents] = useState<Record<string, boolean>>({
    "webhook.test": true,
    "task.created": false,
    "task.updated": false,
    "task.deleted": false,
    "board.created": false,
  });
  const [failMode, setFailMode] = useState(false);

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [received, setReceived] = useState<Received[]>([]);
  const [table, setTable] = useState<Delivery[]>([]);

  // the delivery we're currently tracking through its lifecycle.
  const [tracked, setTracked] = useState<Delivery | null>(null);
  const [eventTypeLabel, setEventTypeLabel] = useState<string>("");
  const [firing, setFiring] = useState(false);
  const [final, setFinal] = useState<"delivered" | "dead" | null>(null);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [waitingBackoff, setWaitingBackoff] = useState(false);

  const { stages, animate, running, setStages } = useStagePipeline(WIRE_STAGES, 430);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── data loaders ────────────────────────────────────────────────────────────
  const loadEndpoints = useCallback(async () => {
    if (!signedIn) {
      setEndpoints([]);
      return;
    }
    try {
      const r = await fetch(`${API}/api/v1/webhooks/endpoints`, { headers: authHeaders() });
      if (r.ok) setEndpoints(await r.json());
    } catch {
      /* offline - leave list as is */
    }
  }, [signedIn]);

  const loadTable = useCallback(async () => {
    if (!signedIn) return;
    try {
      const r = await fetch(`${API}/api/v1/webhooks/deliveries`, { headers: authHeaders() });
      if (r.ok) {
        const data: Delivery[] = await r.json();
        data.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        setTable(data.slice(0, 6));
      }
    } catch {
      /* ignore */
    }
  }, [signedIn]);

  useEffect(() => {
    loadEndpoints();
    loadTable();
  }, [loadEndpoints, loadTable]);

  // Live inspector: every POST reaching the in-app inbox arrives as a
  // `webhook.received` SSE event, with its signature pre-verified server-side.
  useEffect(() => {
    const es = new EventSource(`${API}/api/v1/stream`);
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          payload: { endpoint_id: string; event_type: string | null; signature_valid: boolean };
          ts: string;
        };
        const p = data.payload;
        setReceived((prev) =>
          [
            {
              id: `r_${Math.random().toString(36).slice(2, 9)}`,
              endpoint_id: p.endpoint_id,
              event_type: p.event_type ?? "unknown",
              signature_valid: p.signature_valid,
              ts: new Date(data.ts).toLocaleTimeString(),
              payload: {
                type: p.event_type,
                endpoint_id: p.endpoint_id,
                signature_valid: p.signature_valid,
              },
              expanded: false,
            } as Received,
            ...prev,
          ].slice(0, 8),
        );
      } catch {
        /* keep-alive comment */
      }
    };
    es.addEventListener("webhook.received", handler as EventListener);
    return () => es.close();
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  // ── actions ─────────────────────────────────────────────────────────────────
  function toggleEvent(k: string) {
    setEvents((s) => ({ ...s, [k]: !s[k] }));
  }

  async function createEndpoint() {
    if (!signedIn || creating) return;
    setCreating(true);
    setCreateErr(null);
    const selected = EVENT_TYPES.filter((k) => events[k]);
    // Always subscribe to webhook.test so the /test fire delivers for the demo.
    const eventTypes = Array.from(new Set(["webhook.test", ...selected]));
    const body: { event_types: string[]; url?: string } = { event_types: eventTypes };
    if (failMode) body.url = FAIL_URL; // sink/fail → retries → dead-letter
    try {
      const r = await fetch(`${API}/api/v1/webhooks/endpoints`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        setCreateErr(`HTTP ${r.status}`);
        return;
      }
      const created = await r.json();
      setSecret(created.secret ?? null);
      await loadEndpoints();
    } catch (e) {
      setCreateErr(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function deleteEndpoint(id: string) {
    try {
      await fetch(`${API}/api/v1/webhooks/endpoints/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch {
      /* ignore */
    }
    await loadEndpoints();
  }

  function toggleFrame(id: string) {
    setReceived((prev) => prev.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f)));
  }

  // Fire a webhook.test event and follow the freshest matching delivery through
  // its REAL lifecycle by polling GET /deliveries.
  async function fireEvent() {
    if (firing || endpoints.length === 0) return;
    if (!events["webhook.test"]) {
      // The /test route only fires webhook.test, so ensure it's selected.
      setEvents((s) => ({ ...s, "webhook.test": true }));
    }
    setFiring(true);
    setFinal(null);
    setTracked(null);
    setWaitingBackoff(false);
    setEventTypeLabel("webhook.test");
    setHasDelivery(true);
    stopPoll();

    // Snapshot existing delivery ids so we can detect the freshly-created one.
    let knownIds = new Set<string>();
    try {
      const r0 = await fetch(`${API}/api/v1/webhooks/deliveries`, { headers: authHeaders() });
      if (r0.ok) knownIds = new Set((await r0.json()).map((d: Delivery) => d.id));
    } catch {
      /* ignore */
    }

    // Fire the test event (delivers webhook.test to all matching endpoints).
    try {
      await fetch(`${API}/api/v1/webhooks/test`, { method: "POST", headers: authHeaders() });
    } catch {
      /* ignore - polling will simply find nothing */
    }

    // Animate the 4 wire stages: Event fired → Queued → Signed → Delivering (active).
    await animate("active");

    // Poll for the new delivery, then follow its real status machine.
    const deadline = Date.now() + 20000;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/v1/webhooks/deliveries`, { headers: authHeaders() });
        if (!r.ok) return;
        const all: Delivery[] = await r.json();
        all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        setTable(all.slice(0, 6));

        // Newest delivery created by this fire: a webhook.test row we hadn't seen.
        const fresh =
          all.find((d) => d.event_type === "webhook.test" && !knownIds.has(d.id)) ??
          all.find((d) => d.event_type === "webhook.test");
        if (fresh) {
          setTracked(fresh);
          setEventTypeLabel(fresh.event_type);
          setWaitingBackoff(fresh.status === "retrying");

          if (fresh.status === "success") {
            stopPoll();
            setFinal("delivered");
            setFiring(false);
            setWaitingBackoff(false);
            setStages(WIRE_STAGES.map((label) => ({ label, status: "done" })));
            return;
          }
          if (fresh.status === "dead") {
            stopPoll();
            setFinal("dead");
            setFiring(false);
            setWaitingBackoff(false);
            setStages(
              WIRE_STAGES.map((label, i) => ({ label, status: i === 3 ? "error" : "done" })),
            );
            return;
          }
        }
      } catch {
        /* transient - keep polling */
      }
      if (Date.now() > deadline) {
        stopPoll();
        setFiring(false);
      }
    }, 1500);
  }

  // Build the attempt-card list from the tracked delivery's real attempt count.
  function attemptCards(): React.ReactNode[] | null {
    if (!tracked) return null;
    const n = Math.max(tracked.attempts, 1);
    const cards: React.ReactNode[] = [];
    for (let i = 1; i <= n; i++) {
      const isLast = i === n;
      const inFlight =
        isLast && (tracked.status === "pending" || tracked.status === "retrying");
      // Earlier attempts in fail-mode all returned 500; the last one carries the real code.
      const code = isLast ? tracked.last_response_code : 500;
      const c =
        inFlight || code === null
          ? "#fbbf24"
          : code >= 200 && code < 300
            ? "#4ade80"
            : "#f87171";
      const codeText =
        inFlight || code === null
          ? "sending…"
          : code >= 200 && code < 300
            ? `${code} OK`
            : `${code} err`;
      if (i > 1) {
        const backoff = BACKOFF[Math.min(i - 2, BACKOFF.length - 1)];
        cards.push(
          <div
            key={`bo_${i}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              flex: "none",
              padding: "0 4px",
            }}
          >
            <div
              style={{ width: 24, height: 0, borderTop: "1.5px dashed #fbbf24", margin: "14px 0 1px" }}
            />
            <div style={{ color: "#fbbf24", fontSize: 10, whiteSpace: "nowrap" }}>
              backoff {backoff}s
            </div>
          </div>,
        );
      }
      cards.push(
        <div
          key={`att_${i}`}
          style={{
            flex: "none",
            minWidth: 104,
            background: "#0d131d",
            border: `1.5px solid ${c}`,
            borderRadius: 9,
            padding: "11px 13px",
            textAlign: "center",
            animation: inFlight ? "pl-stage 1.1s ease-in-out infinite" : undefined,
          }}
        >
          <div style={{ fontSize: 11, color: "#8595ab" }}>Attempt #{i}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: c, marginTop: 5 }}>{codeText}</div>
        </div>,
      );
    }
    return cards;
  }

  const canFire = endpoints.length > 0 && !firing && !running;
  const canReplay = !!final && !firing && !running;
  const noEndpoints = endpoints.length === 0;

  return (
    <div>
      <PageHeader
        command="webhooks"
        flag="--signed --retried"
        subtitle="Fire an event and watch each delivery move through its full lifecycle: queued, signed, attempted, retried with backoff, delivered or dead-lettered."
      />
      <StepList
        minCol={210}
        steps={[
          "Sign in.",
          <>
            Create an <span style={{ color: "#4ade80" }}>endpoint</span> (points at this app&apos;s inbox).
          </>,
          <>
            <span style={{ color: "#4ade80" }}>Fire</span> an event.
          </>,
          <>
            Watch it travel its <span style={{ color: "#4ade80" }}>state machine</span>, signature verified live.
          </>,
        ]}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px minmax(0,1fr)",
          gridTemplateAreas: "'wire wire' 'trigger inspector'",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* ── the wire · delivery state machine ──────────────────────────────── */}
        <Panel style={{ gridArea: "wire", padding: "20px 22px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <div style={{ color: "#8595ab", fontSize: 11, flex: 1 }}>
              // the wire · delivery state machine
            </div>
            <button
              onClick={fireEvent}
              disabled={!canReplay}
              style={{
                background: "none",
                border: "1px solid #202c3e",
                color: canReplay ? "#8595ab" : "#3f4d63",
                fontFamily: "inherit",
                fontSize: 11.5,
                padding: "5px 11px",
                borderRadius: 7,
                cursor: canReplay ? "pointer" : "default",
              }}
            >
              ↻ Replay
            </button>
          </div>

          <StagePipeline stages={stages} maxWidth={680} />

          {hasDelivery && (
            <div style={{ marginTop: 24, borderTop: "1px dashed #202c3e", paddingTop: 20 }}>
              <div style={{ color: "#8595ab", fontSize: 11, marginBottom: 8 }}>
                signed at stage 3 · <span style={{ color: "#4ade80" }}>HMAC-SHA256</span>
              </div>
              <pre
                dangerouslySetInnerHTML={{ __html: signingHtml(eventTypeLabel) }}
                style={{
                  margin: "0 0 20px",
                  padding: "12px 14px",
                  background: "#0d131d",
                  border: "1px solid #202c3e",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 11,
                  lineHeight: 1.7,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              />
              <div style={{ color: "#8595ab", fontSize: 11, marginBottom: 14 }}>
                delivery attempts · <span style={{ color: "#38bdf8" }}>{eventTypeLabel || "-"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {tracked ? (
                  attemptCards()
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      flex: "none",
                      color: "#fbbf24",
                      fontSize: 11,
                      animation: "pl-stage 1.1s ease-in-out infinite",
                      border: "1px dashed #fbbf24",
                      borderRadius: 8,
                      padding: "9px 12px",
                    }}
                  >
                    queued · awaiting first attempt
                  </div>
                )}
                {waitingBackoff && !final && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      flex: "none",
                      color: "#fbbf24",
                      fontSize: 11,
                      animation: "pl-stage 1.1s ease-in-out infinite",
                      border: "1px dashed #fbbf24",
                      borderRadius: 8,
                      padding: "9px 12px",
                    }}
                  >
                    waiting · retry scheduled
                  </div>
                )}
                {final && (
                  <>
                    <div style={{ color: "#3f4d63", fontSize: 16, flex: "none" }}>→</div>
                    <div
                      style={{
                        flex: "none",
                        background: `${final === "delivered" ? "#4ade80" : "#f87171"}1a`,
                        border: `1.5px solid ${final === "delivered" ? "#4ade80" : "#f87171"}`,
                        color: final === "delivered" ? "#4ade80" : "#f87171",
                        borderRadius: 9,
                        padding: "11px 15px",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {final === "delivered" ? "✓ Delivered" : "✗ Dead-letter"}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {noEndpoints && !hasDelivery && (
            <div
              style={{
                marginTop: 22,
                textAlign: "center",
                color: "#3f4d63",
                fontSize: 12.5,
                lineHeight: 1.7,
              }}
            >
              // create an endpoint, then fire an event
              <br />
              to watch a delivery travel its lifecycle
            </div>
          )}
        </Panel>

        {/* ── trigger ────────────────────────────────────────────────────────── */}
        <Panel style={{ gridArea: "trigger" }}>
          <Caption>// trigger</Caption>
          <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 8 }}>event types</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
            {EVENT_TYPES.map((k) => {
              const on = events[k];
              return (
                <button
                  key={k}
                  onClick={() => toggleEvent(k)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      flex: "none",
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      border: `1.5px solid ${on ? "#4ade80" : "#3f4d63"}`,
                      background: on ? "#4ade80" : "transparent",
                      color: "#0b0f17",
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: 12.5, color: on ? "#d7e0ee" : "#8595ab" }}>{k}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setFailMode((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              marginBottom: 14,
              width: "100%",
            }}
          >
            <span
              style={{
                width: 34,
                height: 18,
                borderRadius: 20,
                flex: "none",
                position: "relative",
                background: failMode ? "rgba(251,191,36,.3)" : "#202c3e",
                border: `1px solid ${failMode ? "#fbbf24" : "#2c3c52"}`,
                transition: "all .2s",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 1,
                  left: failMode ? 17 : 1,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: failMode ? "#fbbf24" : "#8595ab",
                  transition: "all .2s",
                }}
              />
            </span>
            <span style={{ fontSize: 12, color: "#8595ab", textAlign: "left" }}>
              make it fail sometimes <span style={{ color: "#3f4d63" }}>(retries + dead-letter)</span>
            </span>
          </button>

          <button
            onClick={createEndpoint}
            disabled={!signedIn || creating}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid #202c3e",
              color: signedIn ? "#d7e0ee" : "#3f4d63",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 700,
              padding: "10px",
              borderRadius: 8,
              cursor: signedIn && !creating ? "pointer" : "default",
            }}
          >
            {creating ? "creating…" : "+ Create endpoint"}
          </button>

          {!signedIn && (
            <div style={{ color: "#fbbf24", fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
              Sign in to create an endpoint.
            </div>
          )}
          {createErr && (
            <div style={{ color: "#f87171", fontSize: 10.5, marginTop: 10 }}>{createErr}</div>
          )}

          {secret && (
            <div
              style={{
                marginTop: 14,
                background: "rgba(251,191,36,.07)",
                border: "1px solid #fbbf24",
                borderRadius: 8,
                padding: "11px 12px",
              }}
            >
              <div style={{ color: "#fbbf24", fontSize: 10, letterSpacing: ".06em", marginBottom: 5 }}>
                SIGNING SECRET · shown once
              </div>
              <div
                style={{
                  color: "#fbbf24",
                  fontSize: 11.5,
                  wordBreak: "break-all",
                  fontWeight: 700,
                }}
              >
                {secret}
              </div>
            </div>
          )}

          {endpoints.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 7 }}>your endpoints</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {endpoints.map((ep) => {
                  const failing = ep.url.includes("/sink/fail");
                  const color = failing ? "#fbbf24" : "#4ade80";
                  return (
                    <div
                      key={ep.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#0d131d",
                        border: "1px solid #202c3e",
                        borderRadius: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          flex: "none",
                          background: color,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 10.5,
                          color: "#8595ab",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ep.url}
                      </span>
                      <span style={{ fontSize: 9.5, color }}>{failing ? "failing" : "healthy"}</span>
                      <button
                        onClick={() => deleteEndpoint(ep.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#3f4d63",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontSize: 13,
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={fireEvent}
            disabled={!canFire}
            style={{
              width: "100%",
              marginTop: 14,
              background: canFire ? "rgba(74,222,128,.10)" : "#0d131d",
              border: `1px solid ${canFire ? "#4ade80" : "#202c3e"}`,
              color: canFire ? "#4ade80" : "#3f4d63",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              padding: "11px",
              borderRadius: 8,
              cursor: canFire ? "pointer" : "default",
            }}
          >
            {firing ? "delivering…" : "▸ Fire event"}
          </button>
        </Panel>

        {/* ── inspector · received deliveries ────────────────────────────────── */}
        <Panel style={{ gridArea: "inspector", minWidth: 0 }}>
          <div style={{ color: "#8595ab", fontSize: 11, marginBottom: 6 }}>
            // inspector · received deliveries
          </div>
          <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 13 }}>
            every POST that reaches the inbox, with its signature verified
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {received.length === 0 && (
              <div style={{ color: "#3f4d63", fontSize: 11.5, padding: "10px 0" }}>
                // waiting for deliveries to reach the inbox…
              </div>
            )}
            {received.map((f) => (
              <div
                key={f.id}
                style={{
                  background: "#0d131d",
                  border: "1px solid #202c3e",
                  borderRadius: 9,
                  overflow: "hidden",
                  animation: "pl-slidein .3s ease",
                }}
              >
                <button
                  onClick={() => toggleFrame(f.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: "11px 12px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: "#3f4d63", fontSize: 11, flex: "none" }}>
                    {f.expanded ? "▾" : "▸"}
                  </span>
                  <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700, flex: 1 }}>
                    {f.event_type}
                  </span>
                  <span style={{ color: "#3f4d63", fontSize: 10 }}>{f.ts}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: f.signature_valid ? "#4ade80" : "#f87171",
                      border: `1px solid ${f.signature_valid ? "#4ade80" : "#f87171"}`,
                      background: `${f.signature_valid ? "#4ade80" : "#f87171"}1a`,
                      padding: "2px 8px",
                      borderRadius: 20,
                    }}
                  >
                    <span
                      style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }}
                    />
                    {f.signature_valid ? "valid" : "invalid"}
                  </span>
                </button>
                {f.expanded && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <div style={{ color: "#3f4d63", fontSize: 10, margin: "4px 0 5px" }}>payload</div>
                    <JsonView
                      value={f.payload}
                      maxHeight={200}
                      style={{ background: "#0b0f17", fontSize: 11, padding: 10, borderRadius: 7 }}
                    />
                    {f.headers && (
                      <>
                        <div style={{ color: "#3f4d63", fontSize: 10, margin: "9px 0 5px" }}>headers</div>
                        <JsonView
                          value={f.headers}
                          maxHeight={160}
                          style={{ background: "#0b0f17", fontSize: 10.5, padding: 10, borderRadius: 7 }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {table.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 9 }}>recent deliveries</div>
              <div style={{ border: "1px solid #202c3e", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 84px 56px 56px",
                    gap: 8,
                    padding: "8px 12px",
                    background: "#0d131d",
                    borderBottom: "1px solid #202c3e",
                    color: "#3f4d63",
                    fontSize: 10,
                  }}
                >
                  <span>event</span>
                  <span>status</span>
                  <span>tries</span>
                  <span>code</span>
                </div>
                {table.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 84px 56px 56px",
                      gap: 8,
                      padding: "9px 12px",
                      borderBottom: "1px solid #14202f",
                      fontSize: 11,
                      color: "#8595ab",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "#38bdf8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.event_type}
                    </span>
                    <span style={{ color: statusColor(r.status) }}>{r.status}</span>
                    <span>{r.attempts}</span>
                    <span style={{ color: codeColor(r.last_response_code, r.status) }}>
                      {r.last_response_code ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
