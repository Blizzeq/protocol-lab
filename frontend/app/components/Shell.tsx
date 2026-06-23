"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "./playground/ui";

const NAV: { href: string; label: string; tag: string }[] = [
  { href: "/", label: "Home", tag: "~" },
  { href: "/rest", label: "REST", tag: "M1" },
  { href: "/graphql", label: "GraphQL", tag: "M2" },
  { href: "/realtime", label: "Real-time", tag: "M3" },
  { href: "/webhooks", label: "Webhooks", tag: "M4" },
  { href: "/grpc", label: "gRPC", tag: "M5" },
  { href: "/mcp", label: "MCP", tag: "M6" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { signedIn, email } = useAuth();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* top header */}
      <header className="z-30 flex h-[46px] flex-none items-center gap-3.5 border-b border-line bg-panel px-4 text-sm">
        <div className="flex items-center gap-[7px]" aria-hidden>
          <span className="h-[11px] w-[11px] rounded-full bg-[#f87171]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#fbbf24]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#4ade80]" />
        </div>
        <span className="text-muted">protocol-lab:~$</span>
        <span className="font-bold text-neon">./run</span>
        <span className="text-muted">--all-paradigms</span>
        <div className="flex-1" />
        {signedIn && email && (
          <span className="text-xs text-muted">
            signed in as <span className="text-cyan">{email}</span>
          </span>
        )}
        <a
          href="https://github.com/Blizzeq/protocol-lab"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line px-[11px] py-[5px] text-[13px] text-muted no-underline transition-colors hover:border-neon hover:text-neon"
        >
          github ↗
        </a>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar nav */}
        <nav className="flex w-[232px] flex-none flex-col gap-[3px] overflow-y-auto border-r border-line bg-panel-2 px-3 py-[18px]">
          <div className="px-2.5 pb-2.5 pt-1 text-[11px] tracking-[0.12em] text-muted">// paradigms</div>
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] no-underline transition-colors ${
                  active ? "bg-panel text-fg" : "text-muted hover:bg-panel hover:text-fg"
                }`}
              >
                <span className="flex-1 text-left">{item.label}</span>
                <span
                  className={`rounded-[5px] border px-1.5 py-px text-[10px] ${
                    active ? "border-neon/50 text-neon" : "border-line text-faint"
                  }`}
                >
                  {item.tag}
                </span>
              </Link>
            );
          })}
          <div className="flex-1" />
          <div className="mt-2.5 border-t border-line px-2.5 pt-3 text-[10px] leading-relaxed text-faint">
            one dataset
            <br />
            one task board
            <br />
            six paradigms
          </div>
        </nav>

        {/* main content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1180px] px-10 pb-20 pt-[34px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
