"use client";

import { useState } from "react";

import { createSampleData, logout, signUpThenLogin } from "@/lib/api";

import { StagePipeline } from "./components/playground/Pipeline";
import { btnGhost, btnPrimary, useAuth } from "./components/playground/ui";

const inputStyle: React.CSSProperties = {
  background: "#0d131d",
  border: "1px solid #202c3e",
  borderRadius: 8,
  color: "#d7e0ee",
  fontFamily: "inherit",
  fontSize: 13,
  padding: "9px 11px",
  outline: "none",
};

export default function Home() {
  const { signedIn, email } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleLabel, setSampleLabel] = useState("Create sample data");

  async function doAuth() {
    if (signedIn) {
      logout();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signUpThenLogin(emailInput, password);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function makeSample() {
    setError(null);
    setSampleLabel("Creating…");
    try {
      await createSampleData();
      setSampleLabel("✓ sample data created");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSampleLabel("Create sample data");
    }
  }

  return (
    <div>
      <div style={{ color: "#8595ab", fontSize: 13, marginBottom: 18 }}>
        protocol-lab:~$ <span style={{ color: "#4ade80" }}>./run</span> --all-paradigms
      </div>
      <h1 style={{ fontSize: 54, fontWeight: 800, margin: "0 0 14px", letterSpacing: "-.02em" }}>
        Protocol Lab
        <span style={{ color: "#4ade80", animation: "pl-blink 1.1s step-end infinite", marginLeft: 4 }}>▮</span>
      </h1>
      <p style={{ color: "#8595ab", fontSize: 16, lineHeight: 1.7, maxWidth: 760, margin: "0 0 30px" }}>
        One dataset, a collaborative task board, exposed through every modern data-exchange paradigm:{" "}
        <span style={{ color: "#d7e0ee" }}>REST, GraphQL, WebSocket/SSE, webhooks, gRPC</span> and{" "}
        <span style={{ color: "#d7e0ee" }}>MCP</span>. Trigger a message and watch it travel through each
        protocol&apos;s own lifecycle, stage by stage, until it resolves.
      </p>

      {/* get started */}
      <div
        style={{
          background: "#111824",
          border: "1px solid #202c3e",
          borderRadius: 12,
          padding: "22px 24px",
          marginBottom: 34,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 14, marginBottom: 6 }}># get started in 3 steps</div>
          <div style={{ color: "#8595ab", fontSize: 12.5, lineHeight: 1.6, maxWidth: 640 }}>
            Sign up with any email to spin up your own sandbox account. No real inbox required, and nothing is
            ever sent there; the address is just your login. Creating it seeds a private task board and issues
            the credentials every paradigm reuses: a bearer token for REST and GraphQL, an API key for MCP, and a
            target for your webhooks.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
          {signedIn ? (
            <div style={{ flex: 1, minWidth: 180, color: "#8595ab", fontSize: 13 }}>
              <span style={{ color: "#4ade80" }}>✓</span> signed in as{" "}
              <span style={{ color: "#38bdf8" }}>{email}</span>
            </div>
          ) : (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
                <span style={{ color: "#8595ab", fontSize: 11 }}>email</span>
                <input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
                <span style={{ color: "#8595ab", fontSize: 11 }}>
                  password <span style={{ color: "#3f4d63" }}>(min 8 chars)</span>
                </span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </label>
            </>
          )}
          <button
            onClick={doAuth}
            disabled={busy || (!signedIn && (!emailInput || password.length < 8))}
            style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}
          >
            {signedIn ? "Log out" : busy ? "…" : "Sign up & sign in"}
          </button>
          <button onClick={makeSample} disabled={!signedIn} style={{ ...btnPrimary, opacity: signedIn ? 1 : 0.4 }}>
            {sampleLabel}
          </button>
        </div>
        {error && <div style={{ color: "#f87171", fontSize: 12, marginTop: 12 }}>{error}</div>}
      </div>

      <div style={{ color: "#8595ab", fontSize: 13, letterSpacing: ".06em", marginBottom: 16 }}>// the big idea</div>
      <div style={{ background: "#111824", border: "1px solid #202c3e", borderRadius: 12, padding: "30px 32px" }}>
        <h2 style={{ fontSize: 25, fontWeight: 800, margin: "0 0 12px", color: "#d7e0ee", letterSpacing: "-.01em" }}>
          Watch the message move<span style={{ color: "#4ade80" }}>.</span>
        </h2>
        <p style={{ color: "#8595ab", fontSize: 14, lineHeight: 1.75, maxWidth: 700, margin: "0 0 30px" }}>
          Every surface in the lab is the <span style={{ color: "#d7e0ee" }}>same collaborative task board</span>,
          behind the same <span style={{ color: "#38bdf8" }}>services/</span> layer. Pick a paradigm on the left,
          trigger a message, and watch it travel that protocol&apos;s own lifecycle,{" "}
          <span style={{ color: "#d7e0ee" }}>stage by stage, frame by frame</span>, until it resolves. The contrast
          between those lifecycles is the whole point.
        </p>
        <StagePipeline
          maxWidth={740}
          stages={[
            { label: "Trigger", status: "done" },
            { label: "In flight", status: "done" },
            { label: "Processing", status: "active" },
            { label: "Response", status: "idle" },
            { label: "Resolved", status: "idle" },
          ]}
        />
        <div style={{ color: "#3f4d63", fontSize: 11.5, marginTop: 20, lineHeight: 1.6 }}>
          // one shape, six personalities · REST resolves in a single round-trip · webhooks retry with backoff and
          dead-letter · real-time never closes · gRPC streams typed frames
        </div>
      </div>
    </div>
  );
}
