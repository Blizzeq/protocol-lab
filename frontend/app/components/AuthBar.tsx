"use client";

import { useEffect, useState } from "react";

import { getEmail, login, logout, register } from "@/lib/api";

export default function AuthBar({ onChange }: { onChange?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(getEmail());
  }, []);

  async function run(action: "signup" | "login") {
    setError(null);
    setBusy(true);
    try {
      if (action === "signup") await register(email, password);
      await login(email, password);
      setCurrent(getEmail());
      setPassword("");
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (current) {
    return (
      <div className="flex items-center gap-3 rounded border border-neon/40 bg-neon/10 px-3 py-2 text-sm">
        <span className="text-fg">
          <span className="text-neon">✓</span> signed in as <strong>{current}</strong>
        </span>
        <button
          onClick={() => {
            logout();
            setCurrent(null);
            onChange?.();
          }}
          className="ml-auto text-cyan hover:underline"
        >
          log out
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-3">
      <p className="text-sm font-medium text-fg">
        <span className="text-muted">$</span> sign in to use the demos
      </p>
      <p className="mt-0.5 text-xs text-muted">
        New here? Pick any email + password (min. 8 chars) and click <em>Sign up</em>. Stored only
        in this browser.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input flex-1"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="password (min. 8 chars)"
          className="input flex-1"
        />
        <div className="flex gap-2">
          <button
            onClick={() => run("signup")}
            disabled={busy || !email || password.length < 8}
            className="btn-neon"
          >
            Sign up
          </button>
          <button onClick={() => run("login")} disabled={busy || !email || !password} className="btn">
            Log in
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
