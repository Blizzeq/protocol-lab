"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Evt = {
  type: string;
  board_id: string | null;
  payload: Record<string, unknown>;
  ts: string;
};

const EVENT_TYPES = [
  "board.created",
  "task.created",
  "task.updated",
  "task.deleted",
  "client.message",
];

const STATUS_COLOR: Record<string, string> = {
  open: "bg-green-500",
  connecting: "bg-amber-500",
  reconnecting: "bg-amber-500",
};

export default function RealtimePage() {
  const [events, setEvents] = useState<Evt[]>([]);
  const [status, setStatus] = useState("connecting");
  const [chart, setChart] = useState<{ t: string; total: number }[]>([]);
  const [total, setTotal] = useState(0);

  const [wsStatus, setWsStatus] = useState("disconnected");
  const [wsMsg, setWsMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/v1/stream`);
    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus("reconnecting");

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as Evt;
        setEvents((prev) => [data, ...prev].slice(0, 50));
        setTotal((n) => n + 1);
        const t = new Date(data.ts).toLocaleTimeString();
        setChart((prev) => [...prev, { t, total: (prev.at(-1)?.total ?? 0) + 1 }].slice(-30));
      } catch {
        // ignore non-JSON keep-alive comments
      }
    };
    EVENT_TYPES.forEach((name) => es.addEventListener(name, handler as EventListener));
    return () => es.close();
  }, []);

  function connectWs() {
    const ws = new WebSocket(`${API.replace(/^http/, "ws")}/api/v1/ws`);
    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    wsRef.current = ws;
  }

  function sendWs() {
    if (wsRef.current?.readyState === WebSocket.OPEN && wsMsg) {
      wsRef.current.send(wsMsg);
      setWsMsg("");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">← Home</Link>
      <h1 className="mt-3 text-2xl font-bold">Real-time — SSE &amp; WebSocket</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        The server pushes board activity over Server-Sent Events. Open this page in two tabs,
        then create a task in <Link className="text-blue-600 underline dark:text-blue-400" href="/reference">/reference</Link> or
        GraphiQL — it appears here instantly.
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLOR[status] ?? "bg-gray-400"}`} />
        <span>SSE: {status}</span>
        <span className="ml-1 text-gray-500">· {total} events received</span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-semibold">Live activity feed</h2>
          <ul className="mt-2 max-h-96 space-y-1 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">
            {events.length === 0 && <li className="text-gray-500">Waiting for events…</li>}
            {events.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-blue-600 dark:text-blue-400">{e.type}</span>
                <span className="truncate text-gray-600 dark:text-gray-400">
                  {JSON.stringify(e.payload)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Events over time</h2>
          <div className="mt-2 h-64 rounded border border-gray-200 p-2 dark:border-gray-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="t" hide />
                <YAxis allowDecimals={false} width={28} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2563eb" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded border border-gray-200 p-4 dark:border-gray-800">
        <h2 className="font-semibold">WebSocket (bidirectional)</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Connect and send a message — the server broadcasts it back through the same bus,
          so it shows up in the live feed above as a <code>client.message</code> event.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button onClick={connectWs} className="rounded bg-gray-800 px-3 py-1.5 text-white dark:bg-gray-200 dark:text-gray-900">
            Connect
          </button>
          <span className="text-gray-500">WS: {wsStatus}</span>
          <input
            value={wsMsg}
            onChange={(e) => setWsMsg(e.target.value)}
            placeholder="Message to broadcast"
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            onClick={sendWs}
            disabled={wsStatus !== "connected"}
            className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
}
