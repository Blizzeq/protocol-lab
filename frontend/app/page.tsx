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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-muted">
        <span className="text-neon">protocol-lab</span>:~${" "}
        <span className="text-fg">./run --all-paradigms</span>
      </p>
      <h1 className="mt-4 text-3xl font-bold text-fg">
        Protocol Lab <span className="cursor align-middle" />
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        One dataset — a collaborative task board — exposed through every modern data-exchange
        paradigm: REST, GraphQL, WebSocket/SSE, webhooks, gRPC and MCP. A portfolio project.
      </p>

      <section className="panel mt-8 p-5">
        <h2 className="text-sm font-semibold text-neon"># get started in 3 steps</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-fg/90">
          <li>Sign up below — any email + a password of 8+ characters.</li>
          <li>Click <span className="text-neon">Create sample data</span> so the demos have something to show.</li>
          <li>Open any module below — each one explains exactly what to do.</li>
        </ol>
        <div className="mt-4">
          <GetStarted />
        </div>
      </section>

      <h2 className="mt-10 text-sm font-semibold text-muted">{"// the six paradigms"}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {PARADIGMS.map((p) => {
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">{p.name}</span>
                <span className="tag border-neon/40 text-neon">{p.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
              <span className="mt-3 inline-block text-sm text-cyan">$ open →</span>
            </>
          );
          const cls = "panel block p-4 transition-colors hover:border-neon/60";
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
    </main>
  );
}
