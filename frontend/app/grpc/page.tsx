"use client";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import Link from "next/link";
import { useState } from "react";

import { GreetService } from "./gen/protocollab/v1/greet_pb";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const client = createClient(GreetService, createConnectTransport({ baseUrl: `${API}/rpc` }));

const PROTO = `service GreetService {
  rpc Greet(GreetRequest) returns (GreetResponse) {}
}

message GreetRequest  { string name = 1; }
message GreetResponse { string greeting = 1; string served_by = 2; }`;

export default function GrpcPage() {
  const [name, setName] = useState("Jakub");
  const [result, setResult] = useState<{ greeting: string; servedBy: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function call() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await client.greet({ name });
      setResult({ greeting: res.greeting, servedBy: res.servedBy });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">$ cd ..</Link>
      <h1 className="mt-3 text-2xl font-bold text-fg">$ grpc --via connect</h1>
      <p className="mt-2 text-sm text-muted">
        A typed Protobuf contract, generated into a Python server and a TypeScript client by{" "}
        <code className="text-cyan">buf</code>. The browser calls it directly over the Connect
        protocol — no Envoy or grpc-web proxy. No sign-in needed.
      </p>

      <ol className="panel mt-4 list-decimal space-y-1 p-4 pl-8 text-sm text-fg/90">
        <li>Type any name in the box on the right.</li>
        <li>Click <span className="text-neon">client.greet()</span> — the typed client calls the Python server.</li>
        <li>Open DevTools → <strong>Network</strong> and find the POST to{" "}
          <code className="text-cyan">/rpc/protocollab.v1.GreetService/Greet</code> — a readable JSON body proves
          it&apos;s a gRPC-style contract called natively from the browser.</li>
      </ol>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-fg">the contract (.proto)</h2>
          <pre className="mt-2 overflow-auto rounded border border-line bg-panel-2 p-3 text-xs text-fg/90">{PROTO}</pre>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg">live call</h2>
          <div className="mt-2 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input flex-1" />
            <button onClick={call} disabled={loading} className="btn-neon">
              {loading ? "Calling…" : "client.greet()"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          {result && (
            <div className="panel mt-3 p-3 text-sm">
              <p className="text-fg">{result.greeting}</p>
              <p className="mt-1 text-xs text-muted">served_by: {result.servedBy}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
