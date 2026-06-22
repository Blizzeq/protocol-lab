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

      const restRes = await fetch(`${API}/api/v1/boards/${bid}/tasks`, { headers });
      const restText = await restRes.text();
      setRest({ size: new Blob([restText]).size, body: restText });

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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">$ cd ..</Link>
      <h1 className="mt-3 text-2xl font-bold text-fg">$ rest-vs-graphql</h1>
      <p className="mt-2 text-sm text-muted">
        Same resource, two approaches. REST returns full objects; GraphQL returns exactly the
        fields you ask for. Compare the response size in bytes.
      </p>

      <ol className="panel mt-4 list-decimal space-y-1 p-4 pl-8 text-sm text-fg/90">
        <li>Sign in below (or on the Home page).</li>
        <li>Make sure you have data — on Home, click <span className="text-neon">Create sample data</span>.</li>
        <li>Click <span className="text-neon">Compare</span>: it fetches the same tasks via REST and via GraphQL.</li>
        <li>See how REST sends every field while GraphQL sends only what you asked for.</li>
      </ol>

      <div className="mt-4">
        <AuthBar onChange={() => setSignedIn(!!getToken())} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button onClick={run} disabled={loading || !signedIn} className="btn-neon">
          {loading ? "Loading…" : "Compare"}
        </button>
        <a className="tlink" href={`${API}/graphql`} target="_blank" rel="noreferrer">open GraphiQL ↗</a>
        <a className="tlink" href="/reference">open Scalar (REST docs) ↗</a>
      </div>

      {error && (
        <p className="mt-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {ratio && (
        <p className="mt-6 text-sm text-fg">
          REST: <strong className="text-warn">{rest!.size} B</strong> · GraphQL:{" "}
          <strong className="text-neon">{gql!.size} B</strong> · REST is{" "}
          <strong className="text-warn">{ratio}×</strong> larger for the same data.
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rest && (
          <section>
            <h2 className="text-sm font-semibold text-fg">REST — full objects ({rest.size} B)</h2>
            <pre className="mt-1 max-h-96 overflow-auto rounded border border-line bg-panel-2 p-3 text-xs text-fg/90">{pretty(rest.body)}</pre>
          </section>
        )}
        {gql && (
          <section>
            <h2 className="text-sm font-semibold text-fg">GraphQL — only id + title ({gql.size} B)</h2>
            <pre className="mt-1 max-h-96 overflow-auto rounded border border-line bg-panel-2 p-3 text-xs text-fg/90">{pretty(gql.body)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
