// Small client-side helper: API base URL + auth token kept in localStorage,
// so every demo page can authenticate without the user pasting a JWT by hand.

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "pl_token";
const EMAIL_KEY = "pl_email";

// Fired whenever the auth session changes, so the shell header + every page can
// react without prop-drilling. Listen with window.addEventListener(AUTH_EVENT, …).
export const AUTH_EVENT = "pl-auth";

function emitAuth(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

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
  emitAuth();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function jsonHeaders(): Record<string, string> {
  return { ...authHeaders(), "content-type": "application/json" };
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
  emitAuth();
}

/** Sign up (ignoring "already exists") then log in - used by the inline Home form. */
export async function signUpThenLogin(email: string, password: string): Promise<void> {
  try {
    await register(email, password);
  } catch {
    /* user may already exist - fall through to login */
  }
  await login(email, password);
}

export type Board = { id: string; name: string; description: string | null };

/** Returns the user's boards (first page). Empty array if signed out / none. */
export async function listBoards(): Promise<Board[]> {
  const r = await fetch(`${API}/api/v1/boards?size=50`, { headers: authHeaders() });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data.items) ? data.items : [];
}

/** Seeds a board + a few tasks so the demos have something to show. */
export async function createSampleData(): Promise<void> {
  const r = await fetch(`${API}/api/v1/boards`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ name: "Launch Q3", description: "Sample board for Protocol Lab" }),
  });
  if (!r.ok) throw new Error(await readError(r));
  const board = await r.json();
  const seed = [
    { title: "Wire up auth", status: "in_progress", priority: "high" },
    { title: "Design empty states", status: "todo", priority: "medium" },
    { title: "Ship changelog", status: "done", priority: "low" },
  ];
  for (const t of seed) {
    await fetch(`${API}/api/v1/boards/${board.id}/tasks`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(t),
    });
  }
}
