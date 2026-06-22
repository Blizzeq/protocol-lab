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
      <div className="flex items-center gap-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-950">
        <span>✓ Signed in as <strong>{current}</strong></span>
        <button
          onClick={() => {
            logout();
            setCurrent(null);
            onChange?.();
          }}
          className="ml-auto text-blue-600 underline dark:text-blue-400"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
      <p className="text-sm font-medium">Sign in to use the demos</p>
      <p className="mt-0.5 text-xs text-gray-500">
        New here? Pick any email + password (min. 8 chars) and click <em>Sign up</em>. It is stored
        only in this browser.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="password (min. 8 chars)"
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <div className="flex gap-2">
          <button
            onClick={() => run("signup")}
            disabled={busy || !email || password.length < 8}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Sign up
          </button>
          <button
            onClick={() => run("login")}
            disabled={busy || !email || !password}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
          >
            Log in
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
