"use client";

import { useState } from "react";

import { API, authHeaders, jsonHeaders, listBoards } from "@/lib/api";

import { CodeBlock, hlJsonHtml, Pre } from "../components/playground/hl";
import { StagePipeline, useStagePipeline } from "../components/playground/Pipeline";
import { Caption, PageHeader, Panel, StepList, useAuth } from "../components/playground/ui";

const MCP_STAGES = ["Claude picks tool", "Arguments", "services/", "Structured result"];

type Arg = { key: string; label: string; placeholder: string };
type Tool = { id: string; desc: string; args: Arg[] };

const MCP_TOOLS: Tool[] = [
  { id: "whoami", desc: "Who is the current authenticated user", args: [] },
  { id: "list_boards", desc: "List every board you can access", args: [] },
  {
    id: "list_tasks",
    desc: "List tasks on a board",
    args: [{ key: "board_id", label: "board_id", placeholder: "b_481" }],
  },
  {
    id: "search_tasks",
    desc: "Full-text search across tasks",
    args: [{ key: "query", label: "query", placeholder: "auth" }],
  },
  {
    id: "create_task",
    desc: "Create a task on a board",
    args: [
      { key: "title", label: "title", placeholder: "Review auth flow" },
      { key: "board_id", label: "board_id", placeholder: "b_481" },
    ],
  },
];

type ToolResult = { result: unknown; text: string };

// Mirror what each MCP tool returns by calling the same REST endpoints its
// services/ layer wraps. On failure we return an { error } structuredContent so
// the JSON-RPC envelope still renders.
async function runTool(tool: string, args: Record<string, string>): Promise<ToolResult> {
  switch (tool) {
    case "whoami": {
      const r = await fetch(`${API}/api/v1/auth/me`, { headers: authHeaders() });
      if (!r.ok) return { result: { error: "Sign in to call whoami." }, text: "Not signed in." };
      const u = await r.json();
      const result = { id: u.id, email: u.email, full_name: u.full_name };
      return { result, text: `Signed in as ${u.email}.` };
    }

    case "list_boards": {
      const r = await fetch(`${API}/api/v1/boards`, { headers: authHeaders() });
      if (!r.ok) return { result: { error: "Sign in to list boards." }, text: "Not signed in." };
      const data = await r.json();
      const boards = (Array.isArray(data.items) ? data.items : []).map((b: Record<string, unknown>) => ({
        id: b.id,
        name: b.name,
        description: b.description,
      }));
      return { result: boards, text: `Found ${boards.length} boards.` };
    }

    case "list_tasks": {
      const boardId = args.board_id || (await listBoards())[0]?.id;
      if (!boardId)
        return {
          result: { error: "No board found - sign in and create sample data first." },
          text: "No board available.",
        };
      const r = await fetch(`${API}/api/v1/boards/${boardId}/tasks`, { headers: authHeaders() });
      if (!r.ok)
        return { result: { error: `Board ${boardId} not found.` }, text: `Board ${boardId} not found.` };
      const data = await r.json();
      const tasks = (Array.isArray(data.items) ? data.items : []).map((t: Record<string, unknown>) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      }));
      return { result: tasks, text: `${tasks.length} tasks on board ${boardId}.` };
    }

    case "search_tasks": {
      const query = args.query || "";
      const boards = await listBoards();
      if (boards.length === 0)
        return { result: { error: "Sign in to search tasks." }, text: "Not signed in." };
      const matches: Array<{ id: unknown; title: unknown; status: unknown }> = [];
      for (const board of boards) {
        const r = await fetch(`${API}/api/v1/boards/${board.id}/tasks`, { headers: authHeaders() });
        if (!r.ok) continue;
        const data = await r.json();
        for (const t of Array.isArray(data.items) ? data.items : []) {
          if (String(t.title).toLowerCase().includes(query.toLowerCase()))
            matches.push({ id: t.id, title: t.title, status: t.status });
        }
      }
      return { result: matches, text: `Found ${matches.length} tasks matching "${query}".` };
    }

    case "create_task": {
      const boardId = args.board_id || (await listBoards())[0]?.id;
      if (!boardId)
        return {
          result: { error: "No board found - sign in and create sample data first." },
          text: "No board available.",
        };
      const title = args.title || "Review auth flow";
      const r = await fetch(`${API}/api/v1/boards/${boardId}/tasks`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!r.ok)
        return {
          result: { error: `Could not create task on board ${boardId}.` },
          text: "Create failed.",
        };
      const t = await r.json();
      const result = { id: t.id, title: t.title, status: t.status };
      return { result, text: `Created task ${t.id}: "${t.title}".` };
    }

    default:
      return { result: {}, text: "ok" };
  }
}

export default function McpPage() {
  useAuth();
  const [toolId, setToolId] = useState("list_boards");
  const [argsByTool, setArgsByTool] = useState<Record<string, Record<string, string>>>({});
  const [envelope, setEnvelope] = useState<{ reqHtml: string; respHtml: string } | null>(null);
  const { stages, animate, running } = useStagePipeline(MCP_STAGES, 360);

  const [keyBusy, setKeyBusy] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const tool = MCP_TOOLS.find((t) => t.id === toolId)!;
  const curArgs = argsByTool[toolId] || {};

  function setArg(key: string, val: string) {
    setArgsByTool((prev) => ({ ...prev, [toolId]: { ...(prev[toolId] || {}), [key]: val } }));
  }

  function selectTool(id: string) {
    if (running) return;
    setToolId(id);
    setEnvelope(null);
  }

  async function invoke() {
    if (running) return;
    setEnvelope(null);
    const reqHtml = hlJsonHtml({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: toolId, arguments: curArgs },
    });

    // Kick off the lifecycle animation and the real backend call together.
    const call = runTool(toolId, curArgs).catch((e) => ({
      result: { error: String(e) },
      text: "Tool call failed.",
    }));
    await animate("done");
    const { result, text } = await call;

    const respHtml = hlJsonHtml({
      jsonrpc: "2.0",
      id: 7,
      result: {
        content: [{ type: "text", text }],
        structuredContent: result,
        isError: false,
      },
    });
    setEnvelope({ reqHtml, respHtml });
  }

  async function createApiKey() {
    if (keyBusy) return;
    setKeyBusy(true);
    try {
      const r = await fetch(`${API}/api/v1/auth/api-keys`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ name: "mcp" }),
      });
      if (r.ok) setApiKey((await r.json()).api_key);
    } finally {
      setKeyBusy(false);
    }
  }

  const codeKey = apiKey ?? "pl_xxx";

  return (
    <div>
      <PageHeader
        command="mcp"
        flag="--connect claude"
        subtitle="Expose the same task-board data to AI models as a small set of curated tools, over the same services/ layer as REST and GraphQL."
      />
      <StepList
        steps={[
          <>
            Sign in &amp; create an <span style={{ color: "#4ade80" }}>API key</span>.
          </>,
          <>
            Try a <span style={{ color: "#4ade80" }}>tool</span> right here in the browser.
          </>,
          <>
            Copy the <span style={{ color: "#4ade80" }}>connect snippet</span> into Claude Code or Desktop.
          </>,
        ]}
      />

      {/* try a tool */}
      <div style={{ color: "#8595ab", fontSize: 13, letterSpacing: ".04em", marginBottom: 14 }}>
        // try a tool
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px minmax(0,1fr)",
          gridTemplateAreas: "'wire wire' 'tools result'",
          gap: 16,
          alignItems: "start",
          marginBottom: 30,
        }}
      >
        {/* the wire */}
        <Panel style={{ gridArea: "wire", padding: "20px 22px 24px" }}>
          <Caption style={{ marginBottom: 18 }}>// the wire · tool-call lifecycle</Caption>
          <StagePipeline stages={stages} maxWidth={640} />
        </Panel>

        {/* curated tools */}
        <Panel style={{ gridArea: "tools" }}>
          <Caption>// curated tools</Caption>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MCP_TOOLS.map((t) => {
              const selected = t.id === toolId;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTool(t.id)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    background: selected ? "rgba(74,222,128,.07)" : "#0d131d",
                    border: `1px solid ${selected ? "#4ade80" : "#202c3e"}`,
                    borderRadius: 9,
                    padding: "11px 13px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: selected ? "#4ade80" : "#d7e0ee" }}>
                    {t.id}
                  </div>
                  <div style={{ fontSize: 11, color: "#8595ab", marginTop: 3, lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {tool.args.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ color: "#3f4d63", fontSize: 10.5 }}>arguments</div>
              {tool.args.map((a) => (
                <label key={a.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ color: "#8595ab", fontSize: 11 }}>{a.label}</span>
                  <input
                    value={curArgs[a.key] || ""}
                    onChange={(e) => setArg(a.key, e.target.value)}
                    placeholder={a.placeholder}
                    spellCheck={false}
                    style={{
                      background: "#0d131d",
                      border: "1px solid #202c3e",
                      borderRadius: 7,
                      color: "#4ade80",
                      fontFamily: "inherit",
                      fontSize: 12,
                      padding: "8px 10px",
                      outline: "none",
                    }}
                  />
                </label>
              ))}
            </div>
          )}

          <button
            onClick={invoke}
            disabled={running}
            style={{
              width: "100%",
              marginTop: 12,
              background: "rgba(74,222,128,.10)",
              border: "1px solid #4ade80",
              color: "#4ade80",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              padding: 10,
              borderRadius: 8,
              cursor: running ? "default" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            {running ? "invoking…" : `▸ Invoke ${toolId}()`}
          </button>
        </Panel>

        {/* result */}
        <Panel style={{ gridArea: "result", minWidth: 0 }}>
          <div style={{ color: "#8595ab", fontSize: 11, marginBottom: 6 }}>
            // json-rpc 2.0 over the MCP transport
          </div>
          <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 12 }}>
            the exact messages exchanged with the model
          </div>
          {!envelope ? (
            <Pre
              html="<span style='color:#3f4d63'>// invoke a tool to see the JSON-RPC result envelope</span>"
              style={{
                padding: 12,
                background: "#0d131d",
                border: "1px solid #202c3e",
                borderRadius: 8,
                lineHeight: 1.55,
              }}
            />
          ) : (
            <>
              <div style={{ color: "#4ade80", fontSize: 10.5, marginBottom: 6 }}>→ request · tools/call</div>
              <Pre
                html={envelope.reqHtml}
                style={{
                  margin: "0 0 14px",
                  padding: 12,
                  background: "#0d131d",
                  border: "1px solid #202c3e",
                  borderRadius: 8,
                  lineHeight: 1.55,
                  maxHeight: 180,
                }}
              />
              <div style={{ color: "#38bdf8", fontSize: 10.5, marginBottom: 6 }}>← response · result</div>
              <Pre
                html={envelope.respHtml}
                style={{
                  margin: 0,
                  padding: 12,
                  background: "#0d131d",
                  border: "1px solid #202c3e",
                  borderRadius: 8,
                  lineHeight: 1.55,
                  maxHeight: 280,
                }}
              />
            </>
          )}
        </Panel>
      </div>

      {/* connect for real */}
      <div style={{ color: "#8595ab", fontSize: 13, letterSpacing: ".04em", marginBottom: 14 }}>
        // connect for real
      </div>
      <Panel style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
          <button
            onClick={createApiKey}
            disabled={keyBusy}
            style={{
              background: "rgba(74,222,128,.10)",
              border: "1px solid #4ade80",
              color: "#4ade80",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 700,
              padding: "9px 16px",
              borderRadius: 8,
              cursor: keyBusy ? "default" : "pointer",
              opacity: keyBusy ? 0.6 : 1,
            }}
          >
            {keyBusy ? "creating…" : apiKey ? "✓ key created" : "Create API key"}
          </button>
          {apiKey && (
            <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700, wordBreak: "break-all" }}>
              {apiKey}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
          <div>
            <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 7 }}>Claude Code · remote (HTTP)</div>
            <CodeBlock code={`claude mcp add --transport http protocol-lab ${API}/mcp`} wrap />
            <div style={{ color: "#8595ab", fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
              <span style={{ color: "#3f4d63" }}>Claude Desktop:</span> Settings → Connectors → Add custom
              connector → URL <span style={{ color: "#38bdf8" }}>{API}/mcp</span>
            </div>
          </div>
          <div>
            <div style={{ color: "#3f4d63", fontSize: 10.5, marginBottom: 7 }}>Local · stdio</div>
            <CodeBlock
              code={`claude mcp add protocol-lab \\\n  -e MCP_API_KEY=${codeKey} \\\n  -- uv run fastmcp run app/mcp_server.py`}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            borderTop: "1px dashed #202c3e",
            paddingTop: 16,
            color: "#8595ab",
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          Because tools call the shared <span style={{ color: "#4ade80" }}>service layer</span>, a task Claude
          creates shows up live on the real-time feed and fires webhooks.
        </div>
      </Panel>
    </div>
  );
}
