import { useState, useRef } from "react";
import { ingestURL, ingestFile } from "../api/ingest";
import type { Source } from "../App";

interface SidebarProps {
  sources: Source[];
  activeNamespace: string | null;
  onSelectSource: (name: string) => void;
  onIngestSuccess: (name: string, type: "url" | "file") => void;
}

export function Sidebar({ sources, activeNamespace, onSelectSource, onIngestSuccess }: SidebarProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleIngestURL = async () => {
    if (!url.trim()) return;
    const name = url.split("/").filter(Boolean).pop() || "repo";
    setLoading(true);
    setError(null);
    try {
      await ingestURL(url, name);
      onIngestSuccess(name, "url");
      setUrl("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    setLoading(true);
    setError(null);
    try {
      await ingestFile(file, name);
      onIngestSuccess(name, "file");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <aside className="w-[300px] shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0f1117]">
      {/* Ingest section */}
      <div className="p-4 border-b border-white/[0.06]">
        <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest mb-3">Add a source</p>

        {/* URL input */}
        <div className="relative mb-2">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleIngestURL()}
            placeholder="github.com/owner/repo"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <button
          onClick={handleIngestURL}
          disabled={loading || !url.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mb-3"
        >
          {loading ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
          {loading ? "Indexing..." : "Ingest repo"}
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-xs text-white/20">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* File upload */}
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" onChange={handleFileUpload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="w-full border border-dashed border-white/[0.12] hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-white/50 hover:text-white/70 text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload docs
        </button>
        <p className="text-center text-[11px] text-white/20 mt-1.5">PDF, TXT, or Markdown</p>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Sources list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">Sources</p>
          <span className="text-[11px] bg-white/[0.06] text-white/40 rounded-full px-2 py-0.5">{sources.length}</span>
        </div>

        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-xs text-white/20 text-center">No sources yet</p>
            <p className="text-[11px] text-white/15 text-center">Add a repo or upload docs to start asking questions.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => onSelectSource(source.name)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeNamespace === source.name
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    : "hover:bg-white/[0.04] text-white/50 hover:text-white/70"
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                  activeNamespace === source.name ? "bg-emerald-500/20" : "bg-white/[0.06]"
                }`}>
                  {source.type === "url" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm truncate">{source.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}