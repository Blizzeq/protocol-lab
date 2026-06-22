"use client";

import { useEffect, useState } from "react";

import { API, authHeaders, getToken } from "@/lib/api";

import AuthBar from "./AuthBar";

export default function ApiKeyMaker() {
  const [signedIn, setSignedIn] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSignedIn(!!getToken()), []);

  async function createKey() {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/v1/auth/api-keys`, {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ name: "mcp" }),
      });
      if (r.ok) setKey((await r.json()).api_key);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AuthBar onChange={() => setSignedIn(!!getToken())} />
      {signedIn && (
        <button
          onClick={createKey}
          disabled={busy}
          className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create an API key for MCP"}
        </button>
      )}
      {key && (
        <p className="mt-2 break-all rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Your API key (shown once) — use it as <code>MCP_API_KEY</code>:{" "}
          <span className="font-mono">{key}</span>
        </p>
      )}
    </div>
  );
}
