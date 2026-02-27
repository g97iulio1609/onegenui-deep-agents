import { useState, useEffect } from "react";
import { AgentList } from "./components/AgentList";
import { AgentChat } from "./components/AgentChat";
import { ToolInspector } from "./components/ToolInspector";
import { MemoryViewer } from "./components/MemoryViewer";
import { GraphVisualizer } from "./components/GraphVisualizer";

interface Agent {
  name: string;
  description: string;
}

type Tab = "chat" | "tools" | "memory" | "graph";

export function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => setAgents(data))
      .catch((err) => setError(err.message));
  }, []);

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "tools", label: "Tools", icon: "🔧" },
    { id: "memory", label: "Memory", icon: "🧠" },
    { id: "graph", label: "Graph", icon: "🕸" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{
        width: 280,
        borderRight: "1px solid #30363d",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        background: "#161b22",
      }}>
        <h1 style={{ fontSize: 18, marginBottom: 16, color: "#58a6ff" }}>
          ⚡ GaussFlow Playground
        </h1>
        {error && <div style={{ color: "#f85149", marginBottom: 8 }}>{error}</div>}
        <AgentList agents={agents} selected={selected} onSelect={(name) => { setSelected(name); setTab("chat"); }} />
      </aside>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selected ? (
          <>
            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid #30363d", background: "#161b22" }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderBottom: tab === t.id ? "2px solid #58a6ff" : "2px solid transparent",
                    background: "transparent",
                    color: tab === t.id ? "#58a6ff" : "#8b949e",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: tab === t.id ? 600 : 400,
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {tab === "chat" && <AgentChat agentName={selected} />}
              {tab === "tools" && <ToolInspector agentName={selected} />}
              {tab === "memory" && <MemoryViewer agentName={selected} />}
              {tab === "graph" && <GraphVisualizer agentName={selected} />}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e" }}>
            Select an agent to start chatting
          </div>
        )}
      </main>
    </div>
  );
}
