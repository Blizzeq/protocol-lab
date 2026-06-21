import { ApiReference } from "@scalar/nextjs-api-reference";

// Interaktywna dokumentacja REST (Scalar) celująca w /openapi.json backendu.
// W dev domyślnie http://localhost:8000; na produkcji ustaw NEXT_PUBLIC_API_URL.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const GET = ApiReference({
  url: `${apiUrl}/openapi.json`,
});
