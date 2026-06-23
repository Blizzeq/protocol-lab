"use client";

import { useEffect, useState } from "react";

import { API, authHeaders, getToken, listBoards } from "@/lib/api";

import { hlJsonHtml, JsonView, Pre } from "../components/playground/hl";
import { StagePipeline, useStagePipeline } from "../components/playground/Pipeline";
import {
  badgeFor,
  Caption,
  linkCyan,
  MetricStat,
  PageHeader,
  Panel,
  StatusBadge,
  StepList,
  useAuth,
} from "../components/playground/ui";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const REST_STAGES = ["Compose", "Auth attached", "In flight", "Server", "Response"];

type Method = "GET" | "POST" | "DELETE" | "BURST";
type Preset = { id: string; method: Method; label: string; isPost?: boolean; isBurst?: boolean };

const PRESETS: Preset[] = [
  { id: "list", method: "GET", label: "/boards" },
  { id: "tasks", method: "GET", label: "/boards/{id}/tasks" },
  { id: "create", method: "POST", label: "/boards/{id}/tasks", isPost: true },
  { id: "filter", method: "GET", label: "/boards/{id}/tasks?status=done" },
  { id: "bad", method: "GET", label: "/boards/{unknown}" },
  { id: "burst", method: "BURST", label: "×130 /boards → 429", isBurst: true },
];

const methodColor = (m: Method): string =>
  m === "GET" ? "#38bdf8" : m === "POST" ? "#4ade80" : m === "DELETE" ? "#f87171" : "#fbbf24";

type Result = {
  code: number;
  bytes: number;
  latency: number;
  bodyHtml: string;
  bodyText: string;
  requestHtml: string;
  headers: [string, string][];
  ok: boolean;
};

function buildRequestHtml(method: string, path: string, body?: string): string {
  const token = getToken() ? "pl_live_••••••••" : "pl_live_<sign in to attach>";
  const lines = [
    `<span style="color:#4ade80;font-weight:700">${method}</span> <span style="color:#d7e0ee">${path}</span> <span style="color:#3f4d63">HTTP/1.1</span>`,
  ];
  const headers: [string, string][] = [
    ["host", new URL(API).host],
    ["authorization", `Bearer ${token}`],
    ["accept", "application/json"],
  ];
  if (body) headers.push(["content-type", "application/json"]);
  for (const [k, v] of headers) {
    lines.push(`<span style="color:#8595ab">${k}</span>: <span style="color:#38bdf8">${v}</span>`);
  }
  let html = lines.join("\n");
  if (body) html += "\n\n" + hlJsonHtml(body);
  return html;
}

export default function RestPage() {
  useAuth();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [body, setBody] = useState('{\n  "title": "Review auth flow",\n  "status": "todo",\n  "priority": "high"\n}');
  const [result, setResult] = useState<Result | null>(null);
  const [showHeaders, setShowHeaders] = useState(false);
  const [copied, setCopied] = useState(false);
  const { stages, animate, running } = useStagePipeline(REST_STAGES, 360);

  useEffect(() => {
    listBoards().then((b) => setBoardId(b[0]?.id ?? null));
  }, []);

  const preset = PRESETS[idx];

  function resolvePath(p: Preset): string {
    const bid = boardId ?? "{create-sample-data}";
    switch (p.id) {
      case "list":
        return "/api/v1/boards";
      case "tasks":
        return `/api/v1/boards/${bid}/tasks`;
      case "create":
        return `/api/v1/boards/${bid}/tasks`;
      case "filter":
        return `/api/v1/boards/${bid}/tasks?status=done`;
      case "bad":
        return `/api/v1/boards/${ZERO_UUID}`;
      default:
        return "/api/v1/boards";
    }
  }

  async function send() {
    if (running) return;
    setResult(null);
    const p = preset;
    const t0 = performance.now();

    if (p.isBurst) {
      // Genuinely trip the real slowapi limiter (120/min) with a rapid burst.
      let last: Response | null = null;
      let text = "{}";
      for (let i = 0; i < 130; i++) {
        last = await fetch(`${API}/api/v1/boards`, { headers: authHeaders() });
        if (last.status === 429) {
          text = await last.text();
          break;
        }
        if (i === 129) text = await last.text();
      }
      const latency = Math.round(performance.now() - t0);
      const code = last?.status ?? 0;
      await animate(code >= 400 ? "error" : "done");
      setResult({
        code,
        bytes: new Blob([text]).size,
        latency,
        bodyHtml: hlJsonHtml(text),
        bodyText: text,
        requestHtml: buildRequestHtml("GET ×130", "/api/v1/boards", undefined),
        headers: last ? [...last.headers.entries()] : [],
        ok: code < 400,
      });
      return;
    }

    const path = resolvePath(p);
    const method = p.method === "BURST" ? "GET" : p.method;
    const init: RequestInit = { method, headers: { ...authHeaders() } };
    if (p.isPost) {
      init.headers = { ...authHeaders(), "content-type": "application/json" };
      init.body = body;
    }
    let r: Response | null = null;
    let text = "";
    try {
      r = await fetch(`${API}${path}`, init);
      text = await r.text();
    } catch (e) {
      text = JSON.stringify({ error: String(e) }, null, 2);
    }
    const latency = Math.round(performance.now() - t0);
    const code = r?.status ?? 0;
    const displayPath = path.replace("/api/v1", "");
    await animate(code >= 400 || code === 0 ? "error" : "done");
    setResult({
      code,
      bytes: new Blob([text]).size,
      latency,
      bodyHtml: hlJsonHtml(text || "{}"),
      bodyText: text || "{}",
      requestHtml: buildRequestHtml(method, displayPath, p.isPost ? body : undefined),
      headers: r ? [...r.headers.entries()] : [],
      ok: code > 0 && code < 400,
    });
  }

  const [badgeLabel, badgeColor] = result ? badgeFor(result.code) : ["", "#8595ab"];

  return (
    <div>
      <PageHeader
        command="rest"
        flag="--crud-over-http"
        subtitle="Build a request, send it, and watch one round-trip resolve: status, timing, size and all."
      />
      <StepList
        steps={[
          "Sign in.",
          <>
            Pick a <span style={{ color: "#4ade80" }}>preset request</span>.
          </>,
          <>
            Hit <span style={{ color: "#4ade80" }}>Send</span> and watch the lifecycle.
          </>,
          <>
            Try <span style={{ color: "#4ade80" }}>Create</span> for a 201, or run the burst to trip the{" "}
            <span style={{ color: "#fbbf24" }}>429</span>.
          </>,
        ]}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px minmax(0,1fr)",
          gridTemplateAreas: "'wire wire' 'trigger result'",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* the wire */}
        <Panel style={{ gridArea: "wire", padding: "20px 22px 24px" }}>
          <Caption style={{ marginBottom: 20 }}>// the wire</Caption>
          <StagePipeline stages={stages} />
          <div style={{ display: "flex", gap: 11, margin: "28px auto 0", maxWidth: 560 }}>
            <MetricStat value={result ? result.latency : "—"} label="LATENCY MS" />
            <MetricStat value={result ? result.bytes : "—"} label="RESPONSE BYTES" />
            <MetricStat
              value={result ? result.code || "—" : "—"}
              label="STATUS CODE"
              color={result ? badgeColor : "#d7e0ee"}
            />
          </div>
          {result && (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
              <StatusBadge label={badgeLabel} color={badgeColor} />
            </div>
          )}
        </Panel>

        {/* trigger */}
        <Panel style={{ gridArea: "trigger" }}>
          <Caption>// trigger</Caption>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {PRESETS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  setIdx(i);
                  setResult(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  background: "#0d131d",
                  border: `1px solid ${i === idx ? "#38bdf8" : "#202c3e"}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11.5,
                  color: "#d7e0ee",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: methodColor(p.method),
                    border: `1px solid ${methodColor(p.method)}`,
                    borderRadius: 5,
                    padding: "1px 6px",
                    flex: "none",
                  }}
                >
                  {p.method}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{p.label}</span>
              </button>
            ))}
          </div>
          {preset.isPost && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: "#8595ab", fontSize: 11, marginBottom: 6 }}>// request body</div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                style={{
                  width: "100%",
                  height: 108,
                  resize: "vertical",
                  background: "#0d131d",
                  border: "1px solid #202c3e",
                  borderRadius: 8,
                  color: "#4ade80",
                  fontFamily: "inherit",
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: 10,
                  outline: "none",
                }}
              />
            </div>
          )}
          <button
            onClick={send}
            disabled={running}
            style={{
              marginTop: 14,
              width: "100%",
              background: "rgba(74,222,128,.10)",
              border: "1px solid #4ade80",
              color: "#4ade80",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px",
              borderRadius: 8,
              cursor: running ? "default" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            {running ? "sending…" : "▸ Send request"}
          </button>
          {!boardId && (
            <div style={{ color: "#fbbf24", fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
              No board yet — sign in &amp; click &ldquo;Create sample data&rdquo; on Home for the task presets.
            </div>
          )}
        </Panel>

        {/* result */}
        <Panel style={{ gridArea: "result", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: "#8595ab", fontSize: 11, flex: 1 }}>// result</div>
            <button
              onClick={() => {
                if (!result) return;
                navigator.clipboard?.writeText(result.bodyText);
                setCopied(true);
                setTimeout(() => setCopied(false), 1100);
              }}
              style={{
                background: "none",
                border: "1px solid #202c3e",
                color: "#8595ab",
                fontFamily: "inherit",
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {copied ? "✓ copied" : "copy"}
            </button>
          </div>
          {!result ? (
            <div style={{ color: "#3f4d63", fontSize: 12, padding: "30px 0", textAlign: "center" }}>
              // run a request to see the response
            </div>
          ) : (
            <>
              <div style={{ color: "#4ade80", fontSize: 10.5, marginBottom: 6 }}>→ sent · http request</div>
              <Pre
                html={result.requestHtml}
                style={{
                  marginBottom: 14,
                  padding: 12,
                  background: "#0d131d",
                  border: "1px solid #202c3e",
                  borderRadius: 8,
                  maxHeight: 170,
                }}
              />
              <div style={{ color: "#38bdf8", fontSize: 10.5, marginBottom: 6 }}>← received · response</div>
              <div
                style={{
                  background: "#0d131d",
                  border: `1px solid ${result.ok ? "#202c3e" : "#f87171"}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #202c3e" }}>
                  <span style={{ color: "#3f4d63", fontSize: 10.5, flex: 1 }}>response.json</span>
                  <span style={{ color: "#3f4d63", fontSize: 10.5 }}>{result.bytes} B</span>
                </div>
                <Pre
                  html={result.bodyHtml}
                  style={{ padding: 13, fontSize: 12, color: "#d7e0ee", maxHeight: 300, border: "none", borderRadius: 0, background: "transparent" }}
                />
              </div>
              <button
                onClick={() => setShowHeaders((s) => !s)}
                style={{ marginTop: 12, background: "none", border: "none", color: "#8595ab", fontFamily: "inherit", fontSize: 12, cursor: "pointer", padding: 0 }}
              >
                {showHeaders ? "▾" : "▸"} response headers
              </button>
              {showHeaders && (
                <JsonView value={Object.fromEntries(result.headers)} maxHeight={200} style={{ marginTop: 8, fontSize: 11.5 }} />
              )}
            </>
          )}
        </Panel>
      </div>

      <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
        <a href="/reference" style={linkCyan}>
          open full API reference (Scalar) ↗
        </a>
        <a href={`${API}/docs`} target="_blank" rel="noreferrer" style={{ ...linkCyan, color: "#8595ab" }}>
          open /docs ↗
        </a>
      </div>
    </div>
  );
}
