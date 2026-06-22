"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API, authHeaders, getToken } from "@/lib/api";

import AuthBar from "../components/AuthBar";

const EVENT_TYPES = ["webhook.test", "board.created", "task.created", "task.updated", "task.deleted"];

type Endpoint = { id: string; url: string; event_types: string[]; is_active: boolean };
type Delivery = { id: string; event_type: string; status: string; attempts: number; last_response_code: number | null };
type Received = { endpoint_id: string; event_type: string | null; signature_valid: boolean };

export default function WebhooksPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [received, setReceived] = useState<Received[]>([]);
  const [selected, setSelected] = useState<string[]>(["webhook.test"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const json = () => ({ ...authHeaders(), "content-type": "application/json" });

  async function refresh() {
    setError(null);
    if (!getToken()) return;
    try {
      const [e, d] = await Promise.all([
        fetch(`${API}/api/v1/webhooks/endpoints`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API}/api/v1/webhooks/deliveries`, { headers: authHeaders() }).then((r) => r.json()),
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
      headers: json(),
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
    await fetch(`${API}/api/v1/webhooks/test`, { method: "POST", headers: authHeaders() });
    setTimeout(refresh, 800);
  }

  async function deleteEndpoint(id: string) {
    await fetch(`${API}/api/v1/webhooks/endpoints/${id}`, { method: "DELETE", headers: authHeaders() });
    refresh();
  }

  function onAuthChange() {
    setSignedIn(!!getToken());
    refresh();
  }

  useEffect(() => {
    setSignedIn(!!getToken());
    refresh();
    const es = new EventSource(`${API}/api/v1/stream`);
    es.addEventListener("webhook.received", (e: MessageEvent) => {
      try {
        setReceived((prev) => [JSON.parse(e.data).payload, ...prev].slice(0, 30));
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">$ cd ..</Link>
      <h1 className="mt-3 text-2xl font-bold text-fg">$ webhooks</h1>
      <p className="mt-2 text-sm text-muted">
        Outgoing webhooks signed per the Standard Webhooks spec (HMAC-SHA256), delivered by a
        durable worker with retries. The inspector is a mini webhook.site that verifies signatures live.
      </p>

      <ol className="panel mt-4 list-decimal space-y-1 p-4 pl-8 text-sm text-fg/90">
        <li>Sign in below.</li>
        <li>Click <span className="text-neon">Create endpoint</span> (it points at this app&apos;s own inbox — no setup).</li>
        <li>Click <span className="text-neon">Fire test event</span> — the server signs and delivers it.</li>
        <li>Watch it appear in the <strong>live inspector</strong> with a green <em>valid</em> badge, and see the delivery status update.</li>
      </ol>

      <div className="mt-4">
        <AuthBar onChange={onAuthChange} />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold text-fg">1 · create endpoint &amp; fire</h2>
          <p className="mt-1 text-xs text-muted">Choose which events it subscribes to:</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-fg/90">
            {EVENT_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selected.includes(t)}
                  onChange={(e) =>
                    setSelected((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                  }
                  className="accent-neon"
                />
                {t}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={createEndpoint} disabled={!signedIn} className="btn-neon">Create endpoint</button>
            <button onClick={fireTest} disabled={!signedIn} className="btn">Fire test event</button>
          </div>
          {secret && (
            <p className="mt-2 break-all rounded border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
              Signing secret (shown once): <span className="font-bold">{secret}</span>
            </p>
          )}

          <h3 className="mt-4 text-sm font-semibold text-fg">your endpoints</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {endpoints.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted">{e.event_types.join(", ") || "(none)"}</span>
                <button onClick={() => deleteEndpoint(e.id)} className="text-danger hover:underline">delete</button>
              </li>
            ))}
            {endpoints.length === 0 && <li className="text-muted">No endpoints yet.</li>}
          </ul>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold text-fg">2 · live inspector (signature verified)</h2>
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">
            {received.length === 0 && <li className="text-muted">Waiting for deliveries…</li>}
            {received.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-ink ${r.signature_valid ? "bg-neon" : "bg-danger"}`}>
                  {r.signature_valid ? "valid" : "invalid"}
                </span>
                <span className="text-fg">{r.event_type}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-fg">recent deliveries</h3>
          <table className="mt-1 w-full text-xs">
            <thead className="text-left text-muted">
              <tr><th>event</th><th>status</th><th>attempts</th><th>code</th></tr>
            </thead>
            <tbody className="text-fg/90">
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="text-cyan">{d.event_type}</td>
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
