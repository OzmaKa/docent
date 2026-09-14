// ─── src/components/ChatPanel.tsx ────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import { streamQueryDocs } from "../api/query";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface ChatPanelProps {
  namespace: string | null;
}

const PROVIDERS = [
  { id: "cohere", label: "Cohere", model: "command-r-08-2024" },
  { id: "groq", label: "Groq", model: "openai/gpt-oss-20b" },
  { id: "gemini", label: "Gemini", model: "gemini-3.6-flash" },
];

function SourcesToggle({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 max-w-[85%]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-white/25 hover:text-white/45 px-1 transition-colors"
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {open ? "Hide" : "Show"} sources ({sources.length})
      </button>

      {open && (
        <div className="mt-1.5 space-y-1">
          {sources.map((src, j) => (
            <div
              key={j}
              className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white/35 leading-relaxed"
            >
              <span className="text-emerald-500/60 font-medium mr-1.5">#{j + 1}</span>
              {src}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ namespace }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState(PROVIDERS[0].id);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading || !namespace) return;
    const question = input.trim();
    setInput("");
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setMessages(prev => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    const selected = PROVIDERS.find(p => p.id === provider)!;

    try {
      await streamQueryDocs(
        question,
        namespace,
        selected.id,
        selected.model,
        (token) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, content: last.content + token };
            return updated;
          });
        },
        (sources) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, sources };
            return updated;
          });
        },
        (message) => {
          setError(message);
        }
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <div className="h-12 border-b border-white/[0.06] flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.4">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-sm text-white/50">Ask about your docs</span>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                provider === p.id
                  ? "bg-emerald-600 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!namespace ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-white font-semibold text-lg mb-1">Ask anything about your codebase</h2>
              <p className="text-white/30 text-sm max-w-sm">Add a GitHub repo or upload documentation on the left to get started.</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p className="text-white/30 text-sm">Ask anything about <span className="text-white/50 font-medium">{namespace}</span></p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                }`}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>

                <div className={`flex-1 ${msg.role === "user" ? "flex flex-col items-end" : ""}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white/[0.04] border border-white/[0.06] text-white/85 rounded-tl-sm"
                  }`}>
                    {msg.content || (loading && i === messages.length - 1 ? (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : null)}
                  </div>

                  {/* Sources — collapsed by default */}
                  {msg.sources && msg.sources.length > 0 && (
                    <SourcesToggle sources={msg.sources} />
                  )}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="px-6 pb-2">
          <p className="text-red-400/80 text-xs text-center">{error}</p>
        </div>
      )}

      <div className="px-6 pb-5 pt-3 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className={`flex gap-3 items-end bg-white/[0.04] border rounded-2xl px-4 py-3 transition-colors ${
            namespace ? "border-white/[0.08] focus-within:border-white/20" : "border-white/[0.04] opacity-50"
          }`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={!namespace || loading}
              placeholder={namespace ? "Ask a question..." : "Add a source first..."}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/20 resize-none focus:outline-none leading-relaxed"
              style={{ maxHeight: "160px" }}
            />
            <button
              onClick={handleSend}
              disabled={!namespace || loading || !input.trim()}
              className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="text-center text-[11px] text-white/15 mt-2">Press Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>
    </main>
  );
}