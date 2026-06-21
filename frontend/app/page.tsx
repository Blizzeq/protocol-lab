import Link from "next/link";

const PARADIGMS = [
  { slug: "rest", name: "REST", blurb: "The foundation — CRUD over HTTP, OpenAPI, pagination, auth", status: "✓ M1" },
  { slug: "graphql", name: "GraphQL", blurb: "The client picks exactly the fields it wants", status: "✓ M2" },
  { slug: "realtime", name: "WebSocket + SSE", blurb: "Real-time data — the server pushes changes", status: "M3" },
  { slug: "webhooks", name: "Webhooks", blurb: "Events instead of polling, with an HMAC signature", status: "M4" },
  { slug: "grpc", name: "gRPC / Connect", blurb: "Typed contract (protobuf), called from the browser", status: "M5" },
  { slug: "mcp", name: "MCP", blurb: "Exposing data to AI models (Claude)", status: "M6" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Protocol Lab</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        One dataset (a collaborative task board) exposed through every modern
        data-exchange paradigm. A portfolio project.
      </p>

      <p className="mt-4 flex flex-wrap gap-4 text-sm">
        <a className="font-medium text-blue-600 underline dark:text-blue-400" href="/reference">
          → REST documentation (Scalar)
        </a>
        <Link className="font-medium text-blue-600 underline dark:text-blue-400" href="/rest-vs-graphql">
          → Demo: REST vs GraphQL
        </Link>
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {PARADIGMS.map((p) => (
          <li key={p.slug} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {p.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{p.blurb}</p>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-gray-500">
        Scaffold (M0). The look will be polished later with Claude Design (M8).
      </p>
    </main>
  );
}
