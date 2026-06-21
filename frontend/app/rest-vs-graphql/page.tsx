"use client";

import Link from "next/link";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Result = { size: number; body: string };

function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default function RestVsGraphql() {
  const [token, setToken] = useState("");
  const [rest, setRest] = useState<Result | null>(null);
  const [gql, setGql] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(null);
    setLoading(true);
    setRest(null);
    setGql(null);
    try {
      const auth = { Authorization: `Bearer ${token}` };

      const boardsRes = await fetch(`${API}/api/v1/boards`, { headers: auth });
      if (!boardsRes.ok) throw new Error(`Lista tablic: HTTP ${boardsRes.status}`);
      const boards = await boardsRes.json();
      const board = boards.items?.[0];
      if (!board) throw new Error("Brak tablic. Utwórz najpierw tablicę z zadaniem (np. w /reference).");
      const bid = board.id;

      // REST: zwraca PEŁNE obiekty zadań (wszystkie pola)
      const restRes = await fetch(`${API}/api/v1/boards/${bid}/tasks`, { headers: auth });
      const restText = await restRes.text();
      setRest({ size: new Blob([restText]).size, body: restText });

      // GraphQL: prosimy TYLKO o id + title
      const gqlRes = await fetch(`${API}/graphql`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          query: "query($id: UUID!){ board(id: $id){ tasks { id title } } }",
          variables: { id: bid },
        }),
      });
      const gqlText = await gqlRes.text();
      setGql({ size: new Blob([gqlText]).size, body: gqlText });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const ratio = rest && gql && gql.size > 0 ? (rest.size / gql.size).toFixed(1) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">← Strona główna</Link>
      <h1 className="mt-3 text-2xl font-bold">REST vs GraphQL — over-fetching</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Ten sam zasób, dwa podejścia. REST zwraca pełne obiekty; GraphQL — dokładnie te pola,
        o które prosisz. Porównaj rozmiar odpowiedzi w bajtach.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a className="text-blue-600 underline dark:text-blue-400" href={`${API}/graphql`} target="_blank">GraphiQL (interaktywny GraphQL)</a>
        <a className="text-blue-600 underline dark:text-blue-400" href="/reference">Scalar (REST docs)</a>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          Token JWT (zaloguj się w <code>/reference</code> lub <code>/docs</code> i wklej access_token)
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOi..."
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          onClick={run}
          disabled={loading || !token}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Ładowanie..." : "Porównaj"}
        </button>
      </div>

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {ratio && (
        <p className="mt-6 text-sm">
          REST: <strong>{rest!.size} B</strong> · GraphQL: <strong>{gql!.size} B</strong> ·
          REST jest <strong>{ratio}×</strong> większy dla tych samych danych.
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rest && (
          <section>
            <h2 className="font-semibold">REST — pełne obiekty ({rest.size} B)</h2>
            <pre className="mt-1 max-h-96 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">{pretty(rest.body)}</pre>
          </section>
        )}
        {gql && (
          <section>
            <h2 className="font-semibold">GraphQL — tylko id + title ({gql.size} B)</h2>
            <pre className="mt-1 max-h-96 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">{pretty(gql.body)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
