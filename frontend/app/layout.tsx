import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Protocol Lab",
  description:
    "One dataset exposed through every modern API paradigm — REST, GraphQL, WebSocket/SSE, webhooks, gRPC, MCP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-panel/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-sm">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-danger/70" />
              <span className="h-3 w-3 rounded-full bg-warn/70" />
              <span className="h-3 w-3 rounded-full bg-neon/70" />
            </span>
            <Link href="/" className="font-medium text-fg no-underline">
              <span className="text-neon">protocol-lab</span>
              <span className="text-muted">:~$</span>
            </Link>
            <a
              href="https://github.com/Blizzeq/protocol-lab"
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-muted no-underline hover:text-fg"
            >
              github ↗
            </a>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted">
            {"// protocol-lab — REST · GraphQL · WebSocket/SSE · webhooks · gRPC · MCP"}
          </div>
        </footer>
      </body>
    </html>
  );
}
