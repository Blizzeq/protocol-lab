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

import { API, authHeaders, getToken } from "@/lib/api";

import AuthBar from "../components/AuthBar";

type Evt = {
  type: string;
  board_id: string | null;
  payload: Record<string, unknown>;
  ts: string;
};

const EVENT_TYPES = ["board.created", "task.created", "task.updated", "task.deleted", "client.message"];
const STATUS_COLOR: Record<string, string> = {
  open: "bg-neon",
  connecting: "bg-warn",
  reconnecting: "bg-warn",
};

export default function RealtimePage() {
  const [events, setEvents] = useState<Evt[]>([]);
  const [status, setStatus] = useState("connecting");
  const [chart, setChart] = useState<{ t: string; total: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [wsStatus, setWsStatus] = useState("disconnected");
  const [wsMsg, setWsMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setSignedIn(!!getToken());
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
        // ignore keep-alive comments
      }
    };
    EVENT_TYPES.forEach((name) => es.addEventListener(name, handler as EventListener));
    return () => es.close();
  }, []);

  async function generateEvent() {
    setNote(null);
    const boards = await fetch(`${API}/api/v1/boards`, { headers: authHeaders() }).then((r) => r.json());
    const board = boards.items?.[0];
    if (!board) {
      setNote('No board yet — go to Home and click "Create sample data".');
      return;
    }
    await fetch(`${API}/api/v1/boards/${board.id}/tasks`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ title: `Task @ ${new Date().toLocaleTimeString()}` }),
    });
  }

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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">$ cd ..</Link>
      <h1 className="mt-3 text-2xl font-bold text-fg">$ realtime --sse --ws</h1>
      <p className="mt-2 text-sm text-muted">
        The server pushes board activity to the browser over Server-Sent Events (SSE).
      </p>

      <ol className="panel mt-4 list-decimal space-y-1 p-4 pl-8 text-sm text-fg/90">
        <li>The feed below is already live (no sign-in needed to watch).</li>
        <li>Sign in, then click <span className="text-neon">Generate an event</span> — a new task appears instantly.</li>
        <li>Or open this page in a second tab and create a task there; both tabs update at once.</li>
      </ol>

      <div className="mt-4">
        <AuthBar onChange={() => setSignedIn(!!getToken())} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLOR[status] ?? "bg-muted"}`} />
        <span className="text-fg">SSE: {status}</span>
        <span className="text-muted">· {total} events received</span>
        <button onClick={generateEvent} disabled={!signedIn} className="btn-neon">
          Generate an event
        </button>
        {note && <span className="text-warn">{note}</span>}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-fg">live activity feed</h2>
          <ul className="panel mt-2 max-h-96 space-y-1 overflow-auto p-3 text-xs">
            {events.length === 0 && <li className="text-muted">Waiting for events…</li>}
            {events.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-neon">{e.type}</span>
                <span className="truncate text-muted">{JSON.stringify(e.payload)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg">events over time</h2>
          <div className="panel mt-2 h-64 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#202c3e" />
                <XAxis dataKey="t" hide />
                <YAxis allowDecimals={false} width={28} stroke="#8595ab" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#111824", border: "1px solid #202c3e", fontSize: 12 }}
                  labelStyle={{ color: "#8595ab" }}
                />
                <Line type="monotone" dataKey="total" stroke="#4ade80" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="panel mt-8 p-4">
        <h2 className="text-sm font-semibold text-fg">websocket (bidirectional)</h2>
        <p className="mt-1 text-sm text-muted">
          Click <span className="text-neon">Connect</span>, type a message and <span className="text-neon">Send</span> —
          the server broadcasts it back through the same bus, so it appears in the feed above as a{" "}
          <code className="text-cyan">client.message</code> event.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button onClick={connectWs} className="btn">Connect</button>
          <span className="text-muted">WS: {wsStatus}</span>
          <input
            value={wsMsg}
            onChange={(e) => setWsMsg(e.target.value)}
            placeholder="Message to broadcast"
            className="input flex-1"
          />
          <button onClick={sendWs} disabled={wsStatus !== "connected"} className="btn-neon">
            Send
          </button>
        </div>
      </section>
    </main>
  );
}
