"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API, jsonHeaders, listBoards } from "@/lib/api";

import { hlJsonHtml, Pre } from "../components/playground/hl";
import {
  Caption,
  ConnectionBadge,
  connBadge,
  type ConnState,
  MetricStat,
  PageHeader,
  Panel,
  StepList,
  useAuth,
} from "../components/playground/ui";

// Event names the backend emits onto the bus (see realtime/router.py + events.py).
const EVENT_NAMES = [
  "board.created",
  "task.created",
  "task.updated",
  "task.deleted",
  "client.message",
  "webhook.received",
  "webhook.test",
] as const;

// Per-type tag colors, ported 1:1 from the design prototype.
const TYPE_COLOR: Record<string, string> = {
  "task.created": "#4ade80",
  "task.updated": "#fbbf24",
  "task.deleted": "#f87171",
  "board.created": "#38bdf8",
  "client.message": "#4ade80",
  "webhook.received": "#38bdf8",
  "webhook.test": "#fbbf24",
};

type RawEvent = {
  type: string;
  board_id: string | null;
  payload: Record<string, unknown>;
  ts?: string;
};

type Frame = {
  id: string;
  type: string;
  color: string;
  ts: string; // HH:MM:SS
  summary: string; // compact "k: v  k: v"
  raw: RawEvent;
};

const FRAME_CAP = 9;
const CHART_CAP = 26;

function hhmmss(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  return t.toTimeString().slice(0, 8);
}

function summarize(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
}

let frameSeq = 0;
function toFrame(ev: RawEvent): Frame {
  const payload = ev.payload && typeof ev.payload === "object" ? ev.payload : {};
  return {
    id: `f_${Date.now()}_${frameSeq++}`,
    type: ev.type,
    color: TYPE_COLOR[ev.type] ?? "#8595ab",
    ts: hhmmss(ev.ts),
    summary: summarize(payload),
    raw: ev,
  };
}

// Map a series of cumulative counts to SVG paths inside the 300×76 viewBox.
const CHART_W = 300;
const CHART_H = 76;
function chartPaths(data: number[]): { line: string; area: string } | null {
  const n = data.length;
  if (n < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const span = Math.max(max - min, 1);
  const pts = data.map((val, i) => {
    const x = (i / (n - 1)) * CHART_W;
    const y = CHART_H - 6 - ((val - min) / span) * (CHART_H - 14);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = "M " + pts.join(" L ");
  const area = `${line} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
  return { line, area };
}

export default function RealtimePage() {
  useAuth();

  const [transport, setTransport] = useState<"SSE" | "WebSocket">("SSE");
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [count, setCount] = useState(0);
  const [chart, setChart] = useState<number[]>([]);
  const [openFrame, setOpenFrame] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // WebSocket panel
  const [wsState, setWsState] = useState<ConnState>("closed");
  const [wsMessage, setWsMessage] = useState("");

  const esRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reopenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef(0);

  const ingest = useCallback((ev: RawEvent) => {
    const frame = toFrame(ev);
    setFrames((prev) => [frame, ...prev].slice(0, FRAME_CAP));
    countRef.current += 1;
    const next = countRef.current;
    setCount(next);
    setChart((prev) => [...prev, next].slice(-CHART_CAP));
  }, []);

  // ── SSE: the always-on feed source ─────────────────────────────────────────
  const openStream = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource(`${API}/api/v1/stream`);
    esRef.current = es;
    setConnState("connecting");

    es.onopen = () => setConnState("open");
    es.onerror = () => {
      // EventSource auto-reconnects; reflect that as "reconnecting".
      if (es.readyState !== EventSource.CLOSED) setConnState("reconnecting");
    };

    for (const name of EVENT_NAMES) {
      es.addEventListener(name, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as RawEvent;
          ingest(data);
        } catch {
          /* ignore malformed frame */
        }
      });
    }
  }, [ingest]);

  useEffect(() => {
    openStream();
    return () => {
      if (reopenTimer.current) clearTimeout(reopenTimer.current);
      // Null the handlers before closing so a late socket callback can't setState
      // on the unmounted component.
      const es = esRef.current;
      if (es) {
        es.onopen = null;
        es.onerror = null;
        es.close();
      }
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Generate event: real POST → arrives back through SSE as task.created ────
  async function generate() {
    setNote(null);
    const boards = await listBoards();
    const board = boards[0];
    if (!board) {
      setNote("No board yet - create sample data on Home.");
      return;
    }
    await fetch(`${API}/api/v1/boards/${board.id}/tasks`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: `Task @ ${new Date().toLocaleTimeString()}` }),
    });
    // The resulting task.created event arrives via the SSE stream above.
  }

  // ── Drop connection: close + reopen so the state machine animates ───────────
  function drop() {
    if (reopenTimer.current) clearTimeout(reopenTimer.current);
    esRef.current?.close();
    esRef.current = null;
    setConnState("reconnecting");
    reopenTimer.current = setTimeout(() => {
      openStream();
    }, 1200);
  }

  // ── WebSocket panel ─────────────────────────────────────────────────────────
  function connectWs() {
    if (wsState === "open" || wsState === "connecting") return;
    setWsState("connecting");
    const ws = new WebSocket(`${API.replace(/^http/, "ws")}/api/v1/ws`);
    wsRef.current = ws;
    ws.onopen = () => setWsState("open");
    ws.onclose = () => setWsState("closed");
    ws.onerror = () => setWsState("error");
  }

  function sendWs() {
    const ws = wsRef.current;
    const msg = wsMessage.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !msg) return;
    ws.send(msg);
    setWsMessage("");
  }

  const rtBadge = connBadge(connState);
  const wsBadge = connBadge(wsState);
  const wsConnLabel =
    wsState === "open" ? "connected" : wsState === "connecting" ? "connecting…" : "Connect";
  const wsCanSend = wsState === "open";
  const paths = chartPaths(chart);

  const chip = (active: boolean): React.CSSProperties => ({
    fontFamily: "inherit",
    fontSize: 12,
    padding: "6px 14px",
    borderRadius: 7,
    cursor: "pointer",
    border: `1px solid ${active ? "#4ade80" : "#202c3e"}`,
    background: active ? "rgba(74,222,128,.08)" : "transparent",
    color: active ? "#4ade80" : "#8595ab",
  });

  return (
    <div>
      <PageHeader
        command="realtime"
        flag="--sse --ws"
        subtitle="The server pushes board activity to the browser. Watch frames arrive live, then watch the connection heal itself."
      />
      <StepList
        steps={[
          <>
            The feed is already <span style={{ color: "#4ade80" }}>live</span>, no sign-in to watch.
          </>,
          <>
            <span style={{ color: "#4ade80" }}>Generate</span> an event, and it appears instantly.
          </>,
          <>
            <span style={{ color: "#4ade80" }}>Drop</span> the connection and watch it heal.
          </>,
        ]}
      />

      {/* control strip */}
      <Panel
        style={{
          padding: "14px 18px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTransport("SSE")} style={chip(transport === "SSE")}>
            SSE
          </button>
          <button onClick={() => setTransport("WebSocket")} style={chip(transport === "WebSocket")}>
            WebSocket
          </button>
        </div>
        <div style={{ width: 1, height: 22, background: "#202c3e" }} />
        <ConnectionBadge label={rtBadge.label} color={rtBadge.color} pulse={rtBadge.pulse} />
        <span style={{ color: "#8595ab", fontSize: 12 }}>
          frames received <span style={{ color: "#d7e0ee", fontWeight: 700 }}>{count}</span>
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={generate}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.15)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          style={{
            background: "rgba(74,222,128,.10)",
            border: "1px solid #4ade80",
            color: "#4ade80",
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 700,
            padding: "9px 15px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ▸ Generate event
        </button>
        <button
          onClick={drop}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#f87171";
            e.currentTarget.style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#202c3e";
            e.currentTarget.style.color = "#8595ab";
          }}
          style={{
            background: "transparent",
            border: "1px solid #202c3e",
            color: "#8595ab",
            fontFamily: "inherit",
            fontSize: 12.5,
            padding: "9px 14px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Drop connection
        </button>
        {note && (
          <div style={{ flexBasis: "100%", color: "#fbbf24", fontSize: 10.5, lineHeight: 1.5 }}>
            {note}
          </div>
        )}
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* frame feed */}
        <Panel>
          <Caption>// live frame feed</Caption>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 300 }}>
            {frames.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3f4d63",
                  fontSize: 12,
                }}
              >
                // waiting for frames…
              </div>
            ) : (
              frames.map((f) => {
                const isOpen = openFrame === f.id;
                return (
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
                      onClick={() => setOpenFrame((cur) => (cur === f.id ? null : f.id))}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        padding: "11px 13px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ color: "#3f4d63", fontSize: 11, flex: "none" }}>
                          {isOpen ? "▾" : "▸"}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: f.color,
                            border: `1px solid ${f.color}`,
                            borderRadius: 5,
                            padding: "2px 7px",
                            flex: "none",
                          }}
                        >
                          {f.type}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span style={{ color: "#3f4d63", fontSize: 10.5 }}>{f.ts}</span>
                      </div>
                      <div
                        style={{
                          color: "#8595ab",
                          fontSize: 11.5,
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                          paddingLeft: 21,
                        }}
                      >
                        {f.summary}
                      </div>
                    </button>
                    {isOpen && (
                      <Pre
                        html={hlJsonHtml(f.raw)}
                        style={{
                          margin: 0,
                          padding: "11px 13px",
                          borderTop: "1px solid #202c3e",
                          background: "#0b0f17",
                          borderRadius: 0,
                          fontSize: 11,
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        {/* chart */}
        <Panel>
          <Caption>// events over time</Caption>
          <div
            style={{
              background: "#0d131d",
              border: "1px solid #202c3e",
              borderRadius: 9,
              padding: 14,
              backgroundImage:
                "linear-gradient(#14202f 1px,transparent 1px),linear-gradient(90deg,#14202f 1px,transparent 1px)",
              backgroundSize: "30px 24px",
            }}
          >
            {paths ? (
              <svg
                viewBox="0 0 300 76"
                preserveAspectRatio="none"
                style={{ width: "100%", height: 200, display: "block" }}
              >
                <path d={paths.area} fill="rgba(74,222,128,.13)" stroke="none" />
                <path
                  d={paths.line}
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : (
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3f4d63",
                  fontSize: 12,
                }}
              >
                // waiting for frames…
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <MetricStat value={count} label="FRAMES RECEIVED" color="#4ade80" big={22} />
            <MetricStat value={transport} label="TRANSPORT" color="#38bdf8" big={15} />
          </div>
        </Panel>
      </div>

      {/* websocket panel */}
      <Panel style={{ padding: "16px 18px", marginTop: 16 }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}
        >
          <div style={{ color: "#8595ab", fontSize: 11 }}>// websocket · bidirectional</div>
          <div style={{ flex: 1 }} />
          <ConnectionBadge label={wsBadge.label} color={wsBadge.color} pulse={wsBadge.pulse} />
          <button
            onClick={connectWs}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#38bdf8";
              e.currentTarget.style.color = "#38bdf8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#202c3e";
              e.currentTarget.style.color = "#d7e0ee";
            }}
            style={{
              background: "transparent",
              border: "1px solid #202c3e",
              color: "#d7e0ee",
              fontFamily: "inherit",
              fontSize: 12,
              padding: "7px 13px",
              borderRadius: 7,
              cursor: "pointer",
            }}
          >
            {wsConnLabel}
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={wsMessage}
            onChange={(e) => setWsMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendWs();
            }}
            placeholder="type a message to broadcast…"
            style={{
              flex: 1,
              background: "#0d131d",
              border: "1px solid #202c3e",
              borderRadius: 8,
              color: "#d7e0ee",
              fontFamily: "inherit",
              fontSize: 13,
              padding: "9px 12px",
              outline: "none",
            }}
          />
          <button
            onClick={sendWs}
            style={{
              background: wsCanSend ? "rgba(74,222,128,.10)" : "#0d131d",
              border: `1px solid ${wsCanSend ? "#4ade80" : "#202c3e"}`,
              color: wsCanSend ? "#4ade80" : "#3f4d63",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 700,
              padding: "9px 16px",
              borderRadius: 8,
              cursor: wsCanSend ? "pointer" : "default",
              flex: "none",
            }}
          >
            Send →
          </button>
        </div>
        <div style={{ color: "#3f4d63", fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          The message is broadcast back through the same bus and appears in the feed above as a{" "}
          <span style={{ color: "#4ade80" }}>client.message</span> frame.
        </div>
      </Panel>
    </div>
  );
}
