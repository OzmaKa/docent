// ─── src/App.tsx ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";

export interface Source {
  id: string;
  name: string;
  type: "url" | "file";
}

function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeNamespace, setActiveNamespace] = useState<string | null>(null);

  const handleIngestSuccess = (name: string, type: "url" | "file") => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      name,
      type,
    };
    setSources(prev => [...prev, newSource]);
    setActiveNamespace(name);
  };

  return (
    <div className="h-screen bg-[#0f1117] text-white flex flex-col overflow-hidden">
      <Header engineOnline={true} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sources={sources}
          activeNamespace={activeNamespace}
          onSelectSource={setActiveNamespace}
          onIngestSuccess={handleIngestSuccess}
        />
        <ChatPanel key={activeNamespace} namespace={activeNamespace} />
      </div>
    </div>
  );
}

export default App;