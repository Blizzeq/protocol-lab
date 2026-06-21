"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const EVENT_TYPES = ["webhook.test", "board.created", "task.created", "task.updated", "task.deleted"];

type Endpoint = { id: string; url: string; event_types: string[]; is_active: boolean };
type Delivery = { id: string; event_type: string; status: string; attempts: number; last_response_code: number | null };
type Received = { endpoint_id: string; event_type: string | null; signature_valid: boolean; at: string };

export default function WebhooksPage() {
  const [token, setToken] = useState("");
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [received, setReceived] = useState<Received[]>([]);
  const [selected, setSelected] = useState<string[]>(["webhook.test"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auth = { Authorization: `Bearer ${token}`, "content-type": "application/json" };

  async function refresh() {
    setError(null);
    try {
      const [e, d] = await Promise.all([
        fetch(`${API}/api/v1/webhooks/endpoints`, { headers: auth }).then((r) => r.json()),
        fetch(`${API}/api/v1/webhooks/deliveries`, { headers: auth }).then((r) => r.json()),
      ]);
      if (Array.isArray(e)) setEndpoints(e);
      if (Array.isArray(d)) setDeliveries(d);
    } catch (err) {
      setError(String(err));
    }
  }

  async function createEndpoint() {
    setSecret(null);
    const r = await fetch(`${API}/api/v1/webhooks/endpoints`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ event_types: selected }),
    });
    if (r.ok) {
      setSecret((await r.json()).secret);
      refresh();
    } else {
      setError(`Create failed: HTTP ${r.status}`);
    }
  }

  async function fireTest() {
    await fetch(`${API}/api/v1/webhooks/test`, { method: "POST", headers: auth });
    setTimeout(refresh, 800);
  }

  async function deleteEndpoint(id: string) {
    await fetch(`${API}/api/v1/webhooks/endpoints/${id}`, { method: "DELETE", headers: auth });
    refresh();
  }

  // Live inspector — public SSE feed, filter to webhook.received
  useEffect(() => {
    const es = new EventSource(`${API}/api/v1/stream`);
    es.addEventListener("webhook.received", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setReceived((prev) => [{ ...data.payload, at: data.ts }, ...prev].slice(0, 30));
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">← Home</Link>
      <h1 className="mt-3 text-2xl font-bold">Webhooks</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Outgoing webhooks signed per the Standard Webhooks spec (HMAC-SHA256), delivered by a
        durable worker with retries. The inspector below is a mini webhook.site that verifies signatures live.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          JWT token (log in via <code>/reference</code>)
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOi..."
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button onClick={refresh} disabled={!token} className="rounded bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900">
          Load
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="font-semibold">Create endpoint</h2>
          <p className="mt-1 text-xs text-gray-500">URL defaults to the in-app inbox (self-contained demo).</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {EVENT_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selected.includes(t)}
                  onChange={(e) =>
                    setSelected((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                  }
                />
                {t}
              </label>
            ))}
          </div>
          <button onClick={createEndpoint} disabled={!token} className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Create
          </button>
          {secret && (
            <p className="mt-2 break-all rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Secret (shown once): <span className="font-mono">{secret}</span>
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={fireTest} disabled={!token} className="rounded bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
              Fire test event
            </button>
          </div>

          <h3 className="mt-4 text-sm font-semibold">Endpoints</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {endpoints.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{e.event_types.join(", ") || "(none)"}</span>
                <button onClick={() => deleteEndpoint(e.id)} className="text-red-600">delete</button>
              </li>
            ))}
            {endpoints.length === 0 && <li className="text-gray-500">No endpoints yet.</li>}
          </ul>
        </section>

        <section className="rounded border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="font-semibold">Live inspector (signature verified)</h2>
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">
            {received.length === 0 && <li className="text-gray-500">Waiting for deliveries…</li>}
            {received.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-white ${r.signature_valid ? "bg-green-600" : "bg-red-600"}`}>
                  {r.signature_valid ? "valid" : "invalid"}
                </span>
                <span className="font-mono">{r.event_type}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 text-sm font-semibold">Recent deliveries</h3>
          <table className="mt-1 w-full text-xs">
            <thead className="text-left text-gray-500">
              <tr><th>event</th><th>status</th><th>attempts</th><th>code</th></tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono">{d.event_type}</td>
                  <td>{d.status}</td>
                  <td>{d.attempts}</td>
                  <td>{d.last_response_code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
