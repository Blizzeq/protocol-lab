import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import Shell from "./components/Shell";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Protocol Lab",
  description:
    "One dataset exposed through every modern API paradigm - REST, GraphQL, WebSocket/SSE, webhooks, gRPC, MCP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} h-full antialiased`}>
      <body className="h-full">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
