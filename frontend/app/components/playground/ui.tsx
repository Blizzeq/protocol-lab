"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { AUTH_EVENT, getEmail, getToken } from "@/lib/api";

// ── auth state hook (shell header + pages subscribe to AUTH_EVENT) ──────────
export function useAuth() {
  const [state, setState] = useState<{ signedIn: boolean; email: string | null }>({
    signedIn: false,
    email: null,
  });
  useEffect(() => {
    const sync = () => setState({ signedIn: !!getToken(), email: getEmail() });
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return state;
}

// ── building blocks ─────────────────────────────────────────────────────────
export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        background: "#111824",
        border: "1px solid #202c3e",
        borderRadius: 12,
        padding: 16,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function Caption({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ color: "#8595ab", fontSize: 11, marginBottom: 13, ...style }}>{children}</div>;
}

export function BackLink() {
  return (
    <Link
      href="/"
      style={{
        color: "#8595ab",
        fontSize: 13,
        textDecoration: "none",
        display: "inline-block",
        marginBottom: 14,
      }}
    >
      $ cd ..
    </Link>
  );
}

export function PageHeader({
  command,
  flag,
  subtitle,
}: {
  command: string;
  flag?: string;
  subtitle: string;
}) {
  return (
    <>
      <BackLink />
      <h1 style={{ fontSize: 31, fontWeight: 800, margin: "0 0 8px" }}>
        $ {command}{" "}
        {flag && <span style={{ color: "#8595ab", fontWeight: 400 }}>{flag}</span>}
        <span style={{ color: "#4ade80", animation: "pl-blink 1.1s step-end infinite", marginLeft: 3 }}>
          ▮
        </span>
      </h1>
      <p style={{ color: "#8595ab", fontSize: 14, margin: "0 0 22px", maxWidth: 720, lineHeight: 1.6 }}>
        {subtitle}
      </p>
    </>
  );
}

export function StepList({ steps, minCol = 230 }: { steps: ReactNode[]; minCol?: number }) {
  return (
    <div
      style={{
        background: "#111824",
        border: "1px solid #202c3e",
        borderRadius: 12,
        padding: "18px 22px",
        marginBottom: 22,
      }}
    >
      <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 13, marginBottom: 14 }}># steps</div>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit,minmax(${minCol}px,1fr))`,
          gap: 12,
        }}
      >
        {steps.map((s, i) => (
          <li
            key={i}
            style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#8595ab", fontSize: 12, lineHeight: 1.5 }}
          >
            <span
              style={{
                flex: "none",
                width: 20,
                height: 20,
                borderRadius: 5,
                background: "#0d131d",
                border: "1px solid #202c3e",
                color: "#4ade80",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
              }}
            >
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── status badge (HTTP-style code → label/color) ────────────────────────────
const CODE_MAP: Record<number, [string, string]> = {
  200: ["200 OK", "#4ade80"],
  201: ["201 Created", "#4ade80"],
  204: ["204 No Content", "#4ade80"],
  400: ["400 Bad Request", "#f87171"],
  401: ["401 Unauthorized", "#f87171"],
  404: ["404 Not Found", "#f87171"],
  422: ["422 Unprocessable", "#f87171"],
  429: ["429 Too Many Requests", "#fbbf24"],
};

export function badgeFor(code: number): [string, string] {
  return CODE_MAP[code] ?? [String(code), "#8595ab"];
}

export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12,
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        background: `${color}1a`,
        padding: "4px 11px",
        borderRadius: 20,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {label}
    </span>
  );
}

// ── connection badge (dot + label, pulses while live) ───────────────────────
export function ConnectionBadge({
  label,
  color,
  pulse,
}: {
  label: string;
  color: string;
  pulse: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flex: "none",
          background: color,
          color,
          animation: pulse ? "pl-pulse 1.1s ease-in-out infinite" : undefined,
        }}
      />
      <span style={{ color, fontSize: 12, fontWeight: 700 }}>{label}</span>
    </span>
  );
}

export type ConnState = "connecting" | "open" | "reconnecting" | "closed" | "error";

export function connBadge(state: ConnState, openLabel = "open"): { label: string; color: string; pulse: boolean } {
  switch (state) {
    case "connecting":
      return { label: "connecting", color: "#fbbf24", pulse: true };
    case "open":
      return { label: openLabel, color: "#4ade80", pulse: openLabel === "streaming" };
    case "reconnecting":
      return { label: "reconnecting", color: "#fbbf24", pulse: true };
    case "error":
      return { label: "error", color: "#f87171", pulse: false };
    default:
      return { label: "closed", color: "#8595ab", pulse: false };
  }
}

// ── metric stat (big number + tiny label) ───────────────────────────────────
export function MetricStat({
  value,
  label,
  color = "#d7e0ee",
  big = 21,
}: {
  value: ReactNode;
  label: string;
  color?: string;
  big?: number;
}) {
  return (
    <div style={{ flex: 1, background: "#0d131d", border: "1px solid #202c3e", borderRadius: 8, padding: "12px 13px" }}>
      <div style={{ fontSize: big, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9.5, color: "#8595ab", letterSpacing: ".09em", marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ── primary / secondary buttons matching the design ─────────────────────────
export const btnPrimary: CSSProperties = {
  background: "rgba(74,222,128,.10)",
  border: "1px solid #4ade80",
  color: "#4ade80",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: "9px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

export const btnGhost: CSSProperties = {
  background: "transparent",
  border: "1px solid #202c3e",
  color: "#d7e0ee",
  fontFamily: "inherit",
  fontSize: 12.5,
  padding: "9px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

export const linkCyan: CSSProperties = {
  color: "#38bdf8",
  textDecoration: "none",
  fontSize: 12.5,
};
