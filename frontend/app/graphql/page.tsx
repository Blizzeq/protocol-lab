"use client";

import { useEffect, useState } from "react";

import { API, authHeaders, jsonHeaders, listBoards } from "@/lib/api";

import { CodeBlock, hlJsonHtml, Pre } from "../components/playground/hl";
import { StagePipeline, useStagePipeline } from "../components/playground/Pipeline";
import { Caption, linkCyan, PageHeader, Panel, StepList, useAuth } from "../components/playground/ui";

const GQ_STAGES = ["Pick fields", "Query shaped", "1 request", "Resolve", "Your fields"];

// Display labels stay snake_case (the design), but the real Strawberry schema
// camelCases names — so the actual query string uses the right-hand value.
type Field = { key: string; label: string; line: string };
const FIELDS: Field[] = [
  { key: "id", label: "id", line: "      id" },
  { key: "title", label: "title", line: "      title" },
  { key: "status", label: "status", line: "      status" },
  { key: "description", label: "description", line: "      description" },
  { key: "priority", label: "priority", line: "      priority" },
  { key: "tags", label: "tags", line: "      tags { name }" },
  { key: "comments", label: "comments", line: "      comments { body }" },
  { key: "created_at", label: "created_at", line: "      createdAt" },
  { key: "updated_at", label: "updated_at", line: "      updatedAt" },
];

const DEFAULT_ON = new Set(["id", "title", "status"]);

function buildQuery(on: Record<string, boolean>): string {
  const sel = FIELDS.filter((f) => on[f.key]);
  const lines = sel.length
    ? sel.map((f) => f.line).join("\n")
    : "      # tick at least one field";
  return `query BoardTasks($id: UUID!) {\n  board(id: $id) {\n    tasks {\n${lines}\n    }\n  }\n}`;
}

type Compare = {
  restBytes: number;
  gqBytes: number;
  restValue: unknown;
  gqValue: unknown;
} | null;

export default function GraphqlPage() {
  useAuth();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, DEFAULT_ON.has(f.key)])),
  );
  const [cmp, setCmp] = useState<Compare>(null);
  const { stages, animate, running } = useStagePipeline(GQ_STAGES, 340);

  useEffect(() => {
    listBoards().then((b) => setBoardId(b[0]?.id ?? null));
  }, []);

  const query = buildQuery(on);

  function toggle(key: string) {
    setOn((s) => ({ ...s, [key]: !s[key] }));
  }

  async function runCompare() {
    if (running || !boardId) return;
    setCmp(null);

    // REST: the full objects payload (everything, every field).
    let restText = "{}";
    let restValue: unknown = {};
    try {
      const r = await fetch(`${API}/api/v1/boards/${boardId}/tasks`, { headers: authHeaders() });
      restText = await r.text();
      restValue = JSON.parse(restText);
    } catch (e) {
      restValue = { error: String(e) };
      restText = JSON.stringify(restValue);
    }
    const restBytes = new Blob([restText]).size;

    // GraphQL: exactly the fields ticked above.
    let gqText = "{}";
    let gqValue: unknown = {};
    try {
      const r = await fetch(`${API}/graphql`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ query, variables: { id: boardId } }),
      });
      gqText = await r.text();
      gqValue = JSON.parse(gqText);
    } catch (e) {
      gqValue = { error: String(e) };
      gqText = JSON.stringify(gqValue);
    }
    const gqBytes = new Blob([gqText]).size;

    await animate("done");
    setCmp({ restBytes, gqBytes, restValue, gqValue });
  }

  const mult = cmp && cmp.gqBytes > 0 ? cmp.restBytes / cmp.gqBytes : 1;
  const multLabel = mult.toFixed(1) + "×";
  const restPath = boardId ? `/boards/${boardId}/tasks` : "/boards/{id}/tasks";

  const runStyle: React.CSSProperties = {
    background: "rgba(74,222,128,.10)",
    border: "1px solid #4ade80",
    color: "#4ade80",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    padding: "10px 20px",
    borderRadius: 8,
    cursor: running || !boardId ? "default" : "pointer",
    opacity: running || !boardId ? 0.6 : 1,
  };

  return (
    <div>
      <PageHeader
        command="graphql"
        flag="--pick-your-fields"
        subtitle="REST returns whole objects; GraphQL returns exactly the fields you tick. Watch the payload shrink."
      />
      <StepList
        steps={[
          "Sign in & ensure sample data.",
          <>
            <span style={{ color: "#4ade80" }}>Tick / untick</span> fields below.
          </>,
          <>
            Compare: REST sends <span style={{ color: "#fbbf24" }}>everything</span>, GraphQL sends only your
            selection.
          </>,
        ]}
      />

      {/* field picker + live query */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: 16,
          marginBottom: 16,
          alignItems: "start",
        }}
      >
        <Panel>
          <Caption>// pick task fields</Caption>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {FIELDS.map((f) => {
              const checked = on[f.key];
              return (
                <button
                  key={f.key}
                  onClick={() => toggle(f.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                    textAlign: "left",
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
                      border: `1.5px solid ${checked ? "#4ade80" : "#3f4d63"}`,
                      background: checked ? "#4ade80" : "transparent",
                      color: "#0b0f17",
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: 12.5, color: checked ? "#d7e0ee" : "#8595ab" }}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 11 }}>
            <div style={{ color: "#8595ab", fontSize: 11, flex: 1 }}>// live query</div>
            <span
              style={{
                color: "#3f4d63",
                fontSize: 10,
                border: "1px solid #202c3e",
                padding: "2px 7px",
                borderRadius: 5,
              }}
            >
              graphql
            </span>
          </div>
          <CodeBlock code={query} wrap style={{ fontSize: 12, lineHeight: 1.6 }} />
          <div style={{ color: "#3f4d63", fontSize: 10.5, marginTop: 10, lineHeight: 1.6 }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>POST</span> /graphql · operationName:{" "}
            <span style={{ color: "#38bdf8" }}>BoardTasks</span> · <span style={{ color: "#4ade80" }}>1 request</span>,
            any depth, versus REST&apos;s 1 + N round-trips for nested data.
          </div>
        </Panel>
      </div>

      {/* the wire: pipeline + comparison */}
      <Panel style={{ padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ color: "#8595ab", fontSize: 11, flex: 1 }}>// the wire</div>
          <button onClick={runCompare} disabled={running || !boardId} style={runStyle}>
            {running ? "resolving…" : "▸ Run both"}
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <StagePipeline stages={stages} maxWidth={720} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            flexWrap: "wrap",
            borderTop: "1px dashed #202c3e",
            paddingTop: 20,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#fbbf24" }}>
              {cmp ? cmp.restBytes : "—"} <span style={{ fontSize: 14, fontWeight: 400 }}>B</span>
            </div>
            <div style={{ fontSize: 10, color: "#8595ab", letterSpacing: ".09em", marginTop: 3 }}>
              REST · FULL OBJECTS
            </div>
          </div>
          <div style={{ color: "#3f4d63", fontSize: 20 }}>vs</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#4ade80" }}>
              {cmp ? cmp.gqBytes : "—"} <span style={{ fontSize: 14, fontWeight: 400 }}>B</span>
            </div>
            <div style={{ fontSize: 10, color: "#8595ab", letterSpacing: ".09em", marginTop: 3 }}>
              GRAPHQL · YOUR FIELDS
            </div>
          </div>
          <div
            style={{
              background: "rgba(74,222,128,.08)",
              border: "1px solid #4ade80",
              borderRadius: 8,
              padding: "10px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>{cmp ? multLabel : "—"}</div>
            <div style={{ fontSize: 10, color: "#8595ab", marginTop: 3 }}>smaller</div>
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#8595ab", fontSize: 12, marginTop: 14 }}>
          {cmp ? `REST is ${multLabel} larger for the same data` : "// run both to compare the payload sizes"}
        </div>
        {!boardId && (
          <div style={{ color: "#fbbf24", fontSize: 10.5, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
            No board yet — sign in &amp; click &ldquo;Create sample data&rdquo; on Home, then run both.
          </div>
        )}
      </Panel>

      {/* two json panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Panel style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 11 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#38bdf8",
                border: "1px solid #38bdf8",
                borderRadius: 5,
                padding: "2px 7px",
              }}
            >
              GET
            </span>
            <span style={{ color: "#8595ab", fontSize: 12, marginLeft: 8, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {restPath}
            </span>
            <span style={{ color: "#fbbf24", fontSize: 11 }}>{cmp ? `${cmp.restBytes} B` : ""}</span>
          </div>
          {cmp ? (
            <Pre
              html={hlJsonHtml(cmp.restValue)}
              style={{
                padding: 13,
                background: "#0d131d",
                border: "1px solid #202c3e",
                borderRadius: 8,
                fontSize: 11.5,
                lineHeight: 1.55,
                maxHeight: 340,
                color: "#d7e0ee",
              }}
            />
          ) : (
            <div style={{ color: "#3f4d63", fontSize: 12, padding: "30px 0", textAlign: "center" }}>
              // run both to see the full objects payload
            </div>
          )}
        </Panel>

        <Panel style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 11 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#4ade80",
                border: "1px solid #4ade80",
                borderRadius: 5,
                padding: "2px 7px",
              }}
            >
              POST
            </span>
            <span style={{ color: "#8595ab", fontSize: 12, marginLeft: 8, flex: 1 }}>/graphql</span>
            <span style={{ color: "#4ade80", fontSize: 11 }}>{cmp ? `${cmp.gqBytes} B` : ""}</span>
          </div>
          {cmp ? (
            <Pre
              html={hlJsonHtml(cmp.gqValue)}
              style={{
                padding: 13,
                background: "#0d131d",
                border: "1px solid #202c3e",
                borderRadius: 8,
                fontSize: 11.5,
                lineHeight: 1.55,
                maxHeight: 340,
                color: "#d7e0ee",
              }}
            />
          ) : (
            <div style={{ color: "#3f4d63", fontSize: 12, padding: "30px 0", textAlign: "center" }}>
              // run both to see only your selected fields
            </div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 18 }}>
        <a href={`${API}/graphql`} target="_blank" rel="noreferrer" style={linkCyan}>
          open GraphiQL ↗
        </a>
      </div>
    </div>
  );
}
