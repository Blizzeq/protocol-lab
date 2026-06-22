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
        <button onClick={createKey} disabled={busy} className="btn-neon mt-2">
          {busy ? "Creating…" : "Create an API key for MCP"}
        </button>
      )}
      {key && (
        <p className="mt-2 break-all rounded border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
          Your API key (shown once) — use it as <code>MCP_API_KEY</code>:{" "}
          <span className="font-bold">{key}</span>
        </p>
      )}
    </div>
  );
}
