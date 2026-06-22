import Link from "next/link";

import GetStarted from "./components/GetStarted";

const PARADIGMS = [
  { slug: "rest", href: "/reference", route: false, name: "REST", status: "✓ M1",
    blurb: "The foundation — CRUD over HTTP, OpenAPI, pagination, auth" },
  { slug: "graphql", href: "/rest-vs-graphql", route: true, name: "GraphQL", status: "✓ M2",
    blurb: "The client picks exactly the fields it wants" },
  { slug: "realtime", href: "/realtime", route: true, name: "WebSocket + SSE", status: "✓ M3",
    blurb: "Real-time data — the server pushes changes" },
  { slug: "webhooks", href: "/webhooks", route: true, name: "Webhooks", status: "✓ M4",
    blurb: "Events instead of polling, with an HMAC signature" },
  { slug: "grpc", href: "/grpc", route: true, name: "gRPC / Connect", status: "✓ M5",
    blurb: "Typed contract (protobuf), called from the browser" },
  { slug: "mcp", href: "/mcp", route: true, name: "MCP", status: "✓ M6",
    blurb: "Exposing data to AI models (Claude)" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Protocol Lab</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        One dataset (a collaborative task board) exposed through every modern data-exchange
        paradigm. A portfolio project.
      </p>

      {/* Onboarding */}
      <section className="mt-8 rounded-lg border border-gray-200 p-5 dark:border-gray-800">
        <h2 className="font-semibold">Get started in 3 steps</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Sign up below (any email + a password of 8+ characters).</li>
          <li>Click <strong>Create sample data</strong> so the demos have something to show.</li>
          <li>Open any demo card — each one explains exactly what to do.</li>
        </ol>
        <div className="mt-4">
          <GetStarted />
        </div>
      </section>

      {/* Paradigm demos */}
      <h2 className="mt-10 font-semibold">Explore the six paradigms</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
        {PARADIGMS.map((p) => {
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {p.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{p.blurb}</p>
              <span className="mt-2 inline-block text-sm font-medium text-blue-600 dark:text-blue-400">
                Open demo →
              </span>
            </>
          );
          const cls =
            "block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 dark:border-gray-800";
          return (
            <li key={p.slug}>
              {p.route ? (
                <Link href={p.href} className={cls}>{inner}</Link>
              ) : (
                <a href={p.href} className={cls}>{inner}</a>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-10 text-sm text-gray-500">
        Functional scaffold — the visual design will be polished later with Claude Design.
      </p>
    </main>
  );
}
