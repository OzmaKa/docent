// ─── src/api/http.ts ─────────────────────────────────────────────────────────
// Shared helpers for every call to the backend.

export const API_URL = import.meta.env.VITE_API_URL;

const UNREACHABLE_MESSAGE =
  "Could not reach the server. It may be waking up (free hosting sleeps when idle), so please try again in about a minute.";

// fetch() wrapper that turns network failures into a readable Error.
// While Render cold-starts, the browser may see a failed request (no status code)
// instead of an HTTP error, so we handle both cases.
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    // keep the original error as `cause` so it's still visible when debugging
    throw new Error(UNREACHABLE_MESSAGE, { cause: err });
  }
}

// Builds a message from a failed response without assuming the body is JSON.
export async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return UNREACHABLE_MESSAGE;
  }
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // the body was not JSON (e.g. an HTML error page)
  }
  return fallback;
}