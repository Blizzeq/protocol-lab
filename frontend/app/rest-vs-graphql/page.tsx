"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API, authHeaders, getToken } from "@/lib/api";

import AuthBar from "../components/AuthBar";

type Result = { size: number; body: string };

function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default function RestVsGraphql() {
  const [signedIn, setSignedIn] = useState(false);
  const [rest, setRest] = useState<Result | null>(null);
  const [gql, setGql] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setSignedIn(!!getToken()), []);

  async function run() {
    setError(null);
    setLoading(true);
    setRest(null);
    setGql(null);
    try {
      const headers = authHeaders();
      const boardsRes = await fetch(`${API}/api/v1/boards`, { headers });
      if (boardsRes.status === 401) throw new Error("Please sign in first (form above).");
      const boards = await boardsRes.json();
      const board = boards.items?.[0];
      if (!board) throw new Error('No boards yet — go to Home and click "Create sample data".');
      const bid = board.id;

      // REST: returns FULL task objects (all fields)
      const restRes = await fetch(`${API}/api/v1/boards/${bid}/tasks`, { headers });
      const restText = await restRes.text();
      setRest({ size: new Blob([restText]).size, body: restText });

      // GraphQL: we ask for ONLY id + title
      const gqlRes = await fetch(`${API}/graphql`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
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
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">← Home</Link>
      <h1 className="mt-3 text-2xl font-bold">REST vs GraphQL — over-fetching</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Same resource, two approaches. REST returns full objects; GraphQL returns exactly the
        fields you ask for. Compare the response size in bytes.
      </p>

      <ol className="mt-4 list-decimal space-y-1 rounded-lg border border-gray-200 p-4 pl-8 text-sm dark:border-gray-800">
        <li>Sign in below (or on the Home page).</li>
        <li>Make sure you have data — on Home, click <strong>Create sample data</strong>.</li>
        <li>Click <strong>Compare</strong>: it fetches the same tasks via REST and via GraphQL.</li>
        <li>See how REST sends every field while GraphQL sends only what you asked for.</li>
      </ol>

      <div className="mt-4">
        <AuthBar onChange={() => setSignedIn(!!getToken())} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={run}
          disabled={loading || !signedIn}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : "Compare"}
        </button>
        <a className="text-blue-600 underline dark:text-blue-400" href={`${API}/graphql`} target="_blank">
          Open GraphiQL
        </a>
        <a className="text-blue-600 underline dark:text-blue-400" href="/reference">Open Scalar (REST docs)</a>
      </div>

      {error && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {ratio && (
        <p className="mt-6 text-sm">
          REST: <strong>{rest!.size} B</strong> · GraphQL: <strong>{gql!.size} B</strong> · REST is{" "}
          <strong>{ratio}×</strong> larger for the same data.
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rest && (
          <section>
            <h2 className="font-semibold">REST — full objects ({rest.size} B)</h2>
            <pre className="mt-1 max-h-96 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">{pretty(rest.body)}</pre>
          </section>
        )}
        {gql && (
          <section>
            <h2 className="font-semibold">GraphQL — only id + title ({gql.size} B)</h2>
            <pre className="mt-1 max-h-96 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-gray-800">{pretty(gql.body)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
