"use client";

import type { CSSProperties } from "react";

// Tiny dependency-free syntax highlighters that return HTML strings, injected via
// dangerouslySetInnerHTML - ported 1:1 from the Claude Design prototype so the
// JSON/code panels look identical (keys grey, strings cyan, numbers green, etc.).

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Highlight a JSON value (object or already-stringified text). */
export function hlJsonHtml(value: unknown): string {
  const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  let out = "";
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (s[j] === "\\") {
          j += 2;
          continue;
        }
        if (s[j] === '"') break;
        j++;
      }
      const tok = s.slice(i, j + 1);
      let k = j + 1;
      while (k < n && /\s/.test(s[k])) k++;
      const isKey = s[k] === ":";
      out += `<span style="color:${isKey ? "#8595ab" : "#38bdf8"}">${esc(tok)}</span>`;
      i = j + 1;
      continue;
    }
    if (/[\d-]/.test(c) && (i === 0 || /[\s:,[]/.test(s[i - 1]))) {
      let j = i;
      while (j < n && /[\d.\-+eE]/.test(s[j])) j++;
      out += `<span style="color:#4ade80">${esc(s.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    const word = s.slice(i, i + 5);
    const m = word.match(/^(true|false|null)/);
    if (m && (i === 0 || /[\s:,[]/.test(s[i - 1]))) {
      out += `<span style="color:#fbbf24">${m[1]}</span>`;
      i += m[1].length;
      continue;
    }
    out += esc(c);
    i++;
  }
  return out;
}

const KEYWORDS =
  /\b(syntax|package|service|rpc|returns|stream|message|export|const|import|type|interface)\b/g;
const TYPES =
  /\b(string|int32|int64|bool|Promise|AsyncIterable|BoardStatsRequest|BoardStatsResponse|WatchRequest|BoardEvent|GetBoardStats|WatchBoard)\b/g;

function hlTokens(escaped: string): string {
  return escaped
    .replace(KEYWORDS, '<span style="color:#4ade80">$1</span>')
    .replace(TYPES, '<span style="color:#38bdf8">$1</span>');
}

/** Highlight a code snippet (.proto / TS / shell). */
export function hlCodeHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const ci = line.indexOf("//");
      if (ci >= 0) {
        return (
          hlTokens(esc(line.slice(0, ci))) +
          `<span style="color:#3f4d63">${esc(line.slice(ci))}</span>`
        );
      }
      const hi = line.indexOf("#");
      if (hi >= 0 && /^\s*#/.test(line)) {
        return `<span style="color:#3f4d63">${esc(line)}</span>`;
      }
      return hlTokens(esc(line));
    })
    .join("\n");
}

const preBase: CSSProperties = {
  margin: 0,
  fontFamily: "inherit",
  fontSize: 11.5,
  lineHeight: 1.6,
  overflow: "auto",
};

/** Renders pre-highlighted HTML in a styled <pre>. */
export function Pre({ html, style, wrap = true }: { html: string; style?: CSSProperties; wrap?: boolean }) {
  return (
    <pre
      style={{
        ...preBase,
        whiteSpace: wrap ? "pre-wrap" : "pre",
        wordBreak: wrap ? "break-word" : "normal",
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** A JSON viewer panel (inset background + border). */
export function JsonView({
  value,
  maxHeight = 300,
  style,
}: {
  value: unknown;
  maxHeight?: number;
  style?: CSSProperties;
}) {
  return (
    <Pre
      html={hlJsonHtml(value)}
      style={{
        padding: 13,
        background: "#0d131d",
        border: "1px solid #202c3e",
        borderRadius: 8,
        fontSize: 12,
        maxHeight,
        color: "#d7e0ee",
        ...style,
      }}
    />
  );
}

/** A code snippet panel (proto / TS / shell). */
export function CodeBlock({
  code,
  wrap = false,
  style,
}: {
  code: string;
  wrap?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Pre
      html={hlCodeHtml(code)}
      wrap={wrap}
      style={{
        padding: 13,
        background: "#0d131d",
        border: "1px solid #202c3e",
        borderRadius: 8,
        color: "#d7e0ee",
        ...style,
      }}
    />
  );
}
