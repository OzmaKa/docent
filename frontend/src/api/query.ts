// ─── src/api/query.ts ────────────────────────────────────────────────────────

// Non-streaming — kept for simple use cases
export async function queryDocs(
  question: string,
  namespace: string,
  provider?: string,
  model?: string
): Promise<{ answer: string; sources: string[] }> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/query/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, namespace, provider, model }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to query");
  }
  return res.json();
}

// Streaming — reads SSE frames and calls back as tokens arrive
export async function streamQueryDocs(
  question: string,
  namespace: string,
  provider: string | undefined,
  model: string | undefined,
  onToken: (token: string) => void,
  onSources: (sources: string[]) => void,
  onError: (message: string) => void,
): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, namespace, provider, model }),
  });

  if (!res.ok || !res.body) {
    onError("Failed to reach the server.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || ""; // keep incomplete frame for next read

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === "token") {
          onToken(parsed.content);
        } else if (parsed.type === "sources") {
          onSources(parsed.sources);
        } else if (parsed.type === "error") {
          onError(parsed.content);
        }
        // type === "done" needs no action — loop just ends naturally
      } catch {
        // skip malformed frame
      }
    }
  }
}