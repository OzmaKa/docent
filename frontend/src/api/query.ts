// ─── src/api/query.ts ────────────────────────────────────────────────────────
import { apiFetch, getErrorMessage } from "./http";

// Non-streaming — kept for simple use cases
export async function queryDocs(
  question: string,
  namespace: string,
  provider?: string,
  model?: string
): Promise<{ answer: string; sources: string[] }> {
  const res = await apiFetch("/query/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, namespace, provider, model }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to query"));
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
  let res: Response;
  try {
    res = await apiFetch("/query/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, namespace, provider, model }),
    });
  } catch (err) {
    onError(err instanceof Error ? err.message : "Failed to reach the server.");
    return;
  }

  if (!res.ok || !res.body) {
    onError(
      res.ok
        ? "Failed to reach the server."
        : await getErrorMessage(res, "Failed to reach the server.")
    );
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
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
  } catch {
    onError("The connection was interrupted. Please try again.");
  }
}