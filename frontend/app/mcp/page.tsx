import Link from "next/link";

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">← Home</Link>
      <h1 className="mt-3 text-2xl font-bold">MCP — connect to Claude</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        The Model Context Protocol server exposes the same task-board data to AI clients as a
        small set of curated tools — over the same <code>services/</code> layer as REST and
        GraphQL. It runs over Streamable HTTP at <code>/mcp</code> and acts as one user (set via
        the <code>MCP_API_KEY</code> environment variable).
      </p>

      <h2 className="mt-8 font-semibold">Tools the model sees</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {TOOLS.map((t) => (
          <li key={t.name} className="flex gap-2">
            <span className="font-mono text-blue-600 dark:text-blue-400">{t.name}</span>
            <span className="text-gray-600 dark:text-gray-400">— {t.desc}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-semibold">Connect (remote, Streamable HTTP)</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Claude Code:</p>
      <pre className="mt-1 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">
{`claude mcp add --transport http protocol-lab ${API}/mcp`}
      </pre>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        Claude Desktop: Settings → Connectors → <em>Add custom connector</em> → URL{" "}
        <code>{API}/mcp</code> (remote servers go through Connectors, not
        claude_desktop_config.json).
      </p>

      <h2 className="mt-8 font-semibold">Connect (local, stdio)</h2>
      <pre className="mt-1 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">
{`# in backend/, with MCP_API_KEY set to a Protocol Lab API key (pl_...)
claude mcp add protocol-lab -e MCP_API_KEY=pl_xxx -- uv run fastmcp run app/mcp_server.py`}
      </pre>

      <p className="mt-8 text-xs text-gray-500">
        Then ask Claude: “list my boards” or “create a task called ‘ship M6’”. Because tools call
        the shared service layer, a task created by Claude shows up live on the{" "}
        <Link className="text-blue-600 underline dark:text-blue-400" href="/realtime">real-time</Link>{" "}
        feed and fires webhooks.
      </p>
    </main>
  );
}
