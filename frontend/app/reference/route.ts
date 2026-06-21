import { ApiReference } from "@scalar/nextjs-api-reference";

// Interactive REST documentation (Scalar) pointing at the backend's /openapi.json.
// In dev defaults to http://localhost:8000; in production set NEXT_PUBLIC_API_URL.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const GET = ApiReference({
  url: `${apiUrl}/openapi.json`,
});
