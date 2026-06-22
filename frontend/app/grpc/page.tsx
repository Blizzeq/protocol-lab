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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">← Home</Link>
      <h1 className="mt-3 text-2xl font-bold">gRPC via ConnectRPC</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        A typed Protobuf contract, generated into a Python server and a TypeScript client by{" "}
        <code>buf</code>. The browser calls it directly over the Connect protocol — no Envoy or
        grpc-web proxy. Open DevTools → Network and watch the POST to{" "}
        <code>/rpc/protocollab.v1.GreetService/Greet</code>.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-semibold">The contract (.proto)</h2>
          <pre className="mt-2 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">{PROTO}</pre>
        </section>

        <section>
          <h2 className="font-semibold">Live call</h2>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              onClick={call}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Calling…" : "client.greet()"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {result && (
            <div className="mt-3 rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
              <p>{result.greeting}</p>
              <p className="mt-1 text-xs text-gray-500">served_by: {result.servedBy}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
