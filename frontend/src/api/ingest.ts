// ─── src/api/ingest.ts ───────────────────────────────────────────────────────
import { apiFetch, getErrorMessage } from "./http";

export interface IngestResult {
  success: boolean;
  namespace: string;
  chunk_count: number;
  message: string;
}

export async function ingestURL(url: string, name: string): Promise<IngestResult> {
  const res = await apiFetch("/ingest/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, name }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to ingest URL"));
  }
  return res.json();
}

export async function ingestFile(file: File, name: string): Promise<IngestResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  const res = await apiFetch("/ingest/file", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to ingest file"));
  }
  return res.json();
}