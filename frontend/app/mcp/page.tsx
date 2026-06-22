import Link from "next/link";

import ApiKeyMaker from "../components/ApiKeyMaker";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOOLS = [
  { name: "whoami", desc: "Return the Protocol Lab user this server acts as" },
  { name: "list_boards", desc: "List the user's boards" },
  { name: "list_tasks", desc: "List tasks in a board (by board id)" },
  { name: "search_tasks", desc: "Search the user's tasks by title" },
  { name: "create_task", desc: "Create a task (also fires real-time + webhook events)" },
];

export default function McpPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">$ cd ..</Link>
      <h1 className="mt-3 text-2xl font-bold text-fg">$ mcp --connect claude</h1>
      <p className="mt-2 text-sm text-muted">
        The Model Context Protocol server exposes the same task-board data to AI clients as a small
        set of curated tools — over the same <code className="text-cyan">services/</code> layer as
        REST and GraphQL. It runs over Streamable HTTP at <code className="text-cyan">/mcp</code> and
        acts as one user (set via <code className="text-cyan">MCP_API_KEY</code>).
      </p>

      <h2 className="mt-8 text-sm font-semibold text-neon"># step 1 · get an API key</h2>
      <p className="mt-1 text-sm text-muted">
        Sign in and create an API key — you&apos;ll paste it as <code className="text-cyan">MCP_API_KEY</code>.
      </p>
      <div className="mt-2">
        <ApiKeyMaker />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neon"># tools the model sees</h2>
      <ul className="panel mt-2 space-y-1 p-4 text-sm">
        {TOOLS.map((t) => (
          <li key={t.name} className="flex gap-2">
            <span className="text-neon">{t.name}</span>
            <span className="text-muted">— {t.desc}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-semibold text-neon"># step 2 · connect (remote, Streamable HTTP)</h2>
      <p className="mt-1 text-sm text-muted">Claude Code:</p>
      <pre className="mt-1 overflow-auto rounded border border-line bg-panel-2 p-3 text-xs text-fg/90">
{`claude mcp add --transport http protocol-lab ${API}/mcp`}
      </pre>
      <p className="mt-3 text-sm text-muted">
        Claude Desktop: Settings → Connectors → <em>Add custom connector</em> → URL{" "}
        <code className="text-cyan">{API}/mcp</code> (remote servers go through Connectors, not
        claude_desktop_config.json).
      </p>

      <h2 className="mt-8 text-sm font-semibold text-neon"># step 3 · or connect locally (stdio)</h2>
      <pre className="mt-1 overflow-auto rounded border border-line bg-panel-2 p-3 text-xs text-fg/90">
{`# in backend/, with MCP_API_KEY set to a Protocol Lab API key (pl_...)
claude mcp add protocol-lab -e MCP_API_KEY=pl_xxx -- uv run fastmcp run app/mcp_server.py`}
      </pre>

      <p className="mt-8 text-xs text-muted">
        Then ask Claude: &ldquo;list my boards&rdquo; or &ldquo;create a task called ship-it&rdquo;.
        Because tools call the shared service layer, a task Claude creates shows up live on the{" "}
        <Link className="tlink" href="/realtime">real-time</Link> feed and fires webhooks.
      </p>
    </main>
  );
}
