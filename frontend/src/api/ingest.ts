// ─── src/api/ingest.ts ───────────────────────────────────────────────────────
export async function ingestURL(url: string, name: string): Promise<{ success: boolean; namespace: string; chunk_count: number; message: string }> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/ingest/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to ingest URL");
  }
  return res.json();
}

export async function ingestFile(file: File, name: string): Promise<{ success: boolean; namespace: string; chunk_count: number; message: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  const res = await fetch(`${import.meta.env.VITE_API_URL}/ingest/file`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to ingest file");
  }
  return res.json();
}