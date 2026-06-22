"use client";

import { useEffect, useState } from "react";

import { API, authHeaders, getToken } from "@/lib/api";

import AuthBar from "./AuthBar";

export default function GetStarted() {
  const [signedIn, setSignedIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSignedIn(!!getToken()), []);

  async function createSample() {
    setBusy(true);
    setMsg(null);
    try {
      const json = { ...authHeaders(), "content-type": "application/json" };
      const board = await fetch(`${API}/api/v1/boards`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ name: "My first board", description: "Sample data" }),
      }).then((r) => r.json());
      for (const title of ["Try the REST API", "Watch the live feed", "Wire up a webhook"]) {
        await fetch(`${API}/api/v1/boards/${board.id}/tasks`, {
          method: "POST",
          headers: json,
          body: JSON.stringify({ title }),
        });
      }
      setMsg('Created board "My first board" with 3 tasks. Now open any module below.');
    } catch (e) {
      setMsg(`Error: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AuthBar onChange={() => setSignedIn(!!getToken())} />
      {signedIn && (
        <div className="mt-2">
          <button onClick={createSample} disabled={busy} className="btn-neon">
            {busy ? "Creating…" : "Create sample data"}
          </button>
          {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}
