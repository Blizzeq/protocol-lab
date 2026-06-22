// Small client-side helper: API base URL + auth token kept in localStorage,
// so every demo page can authenticate without the user pasting a JWT by hand.

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "pl_token";
const EMAIL_KEY = "pl_email";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(r: Response): Promise<string> {
  try {
    const body = await r.json();
    if (body.errors?.[0]?.msg) return body.errors[0].msg;
    if (body.detail) return body.detail;
  } catch {
    /* fall through */
  }
  return `HTTP ${r.status}`;
}

export async function register(email: string, password: string): Promise<void> {
  const r = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(await readError(r));
}

export async function login(email: string, password: string): Promise<void> {
  const r = await fetch(`${API}/api/v1/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });
  if (!r.ok) throw new Error("Incorrect email or password");
  const data = await r.json();
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(EMAIL_KEY, email);
}
