const PARADIGMS = [
  { slug: "rest", name: "REST", blurb: "Fundament — CRUD po HTTP, OpenAPI, paginacja, auth", status: "✓ M1" },
  { slug: "graphql", name: "GraphQL", blurb: "Klient wybiera dokładnie te pola, których chce", status: "M2" },
  { slug: "realtime", name: "WebSocket + SSE", blurb: "Dane w czasie rzeczywistym — serwer wypycha zmiany", status: "M3" },
  { slug: "webhooks", name: "Webhooki", blurb: "Zdarzenia zamiast odpytywania, z podpisem HMAC", status: "M4" },
  { slug: "grpc", name: "gRPC / Connect", blurb: "Typowany kontrakt (protobuf), wywołanie z przeglądarki", status: "M5" },
  { slug: "mcp", name: "MCP", blurb: "Udostępnienie danych modelom AI (Claude)", status: "M6" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Protocol Lab</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Jeden zbiór danych (kolaboracyjna tablica zadań) udostępniony przez wszystkie
        nowoczesne paradygmaty wymiany informacji. Projekt portfolio.
      </p>

      <p className="mt-4 flex gap-4 text-sm">
        <a className="font-medium text-blue-600 underline dark:text-blue-400" href="/reference">
          → Interaktywna dokumentacja REST (Scalar)
        </a>
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {PARADIGMS.map((p) => (
          <li key={p.slug} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {p.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{p.blurb}</p>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-gray-500">
        Szkielet (M0). Wygląd dopracujemy później przez Claude Design (M8).
      </p>
    </main>
  );
}
