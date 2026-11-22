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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleIngestSuccess = (name: string, type: "url" | "file") => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      name,
      type,
    };
    setSources(prev => [...prev, newSource]);
    setActiveNamespace(name);
    setSidebarOpen(false);
  };

  const handleSelectSource = (name: string) => {
    setActiveNamespace(name);
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen bg-[#0f1117] text-white flex flex-col overflow-hidden">
      <Header
        engineOnline={true}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        sidebarOpen={sidebarOpen}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          sources={sources}
          activeNamespace={activeNamespace}
          onSelectSource={handleSelectSource}
          onIngestSuccess={handleIngestSuccess}
          isOpen={sidebarOpen}
        />
        <ChatPanel key={activeNamespace} namespace={activeNamespace} />
      </div>
    </div>
  );
}

export default App;