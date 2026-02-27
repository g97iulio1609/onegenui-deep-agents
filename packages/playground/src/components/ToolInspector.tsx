import { useState, useEffect } from "react";

interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

interface ToolInspectorProps {
  agentName: string;
}

export function ToolInspector({ agentName }: ToolInspectorProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agents/${encodeURIComponent(agentName)}/tools`)
      .then((r) => { if (!r.ok) throw new Error("HTTP error"); return r.json(); })
      .then((data) => { if (!cancelled) { setTools(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentName]);

  if (loading) return <div style={{ padding: 16, color: "#8b949e" }}>Loading tools...</div>;
  if (tools.length === 0) return <div style={{ padding: 16, color: "#8b949e" }}>No tools registered</div>;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, color: "#58a6ff", marginBottom: 12 }}>🔧 Tools ({tools.length})</h3>
      {tools.map((tool) => (
        <div
          key={tool.name}
          style={{
            marginBottom: 8,
            border: "1px solid #30363d",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              background: expanded === tool.name ? "#1c2128" : "#161b22",
              color: "#c9d1d9",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 600 }}>{tool.name}</span>
            <span style={{ color: "#8b949e", fontSize: 12 }}>{expanded === tool.name ? "▼" : "▶"}</span>
          </button>
          {expanded === tool.name && (
            <div style={{ padding: "10px 14px", background: "#0d1117", borderTop: "1px solid #30363d" }}>
              <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 8 }}>{tool.description}</div>
              {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#58a6ff", marginBottom: 4, textTransform: "uppercase" }}>Parameters</div>
                  <pre style={{ fontSize: 12, color: "#c9d1d9", background: "#161b22", padding: 8, borderRadius: 4, overflow: "auto" }}>
                    {JSON.stringify(tool.parameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
