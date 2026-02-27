import { useState, useEffect } from "react";

interface MemoryEntry {
  key: string;
  value: unknown;
  tier: "short" | "working" | "semantic" | "observation";
  timestamp: number;
}

interface MemoryViewerProps {
  agentName: string;
}

const TIER_COLORS: Record<string, string> = {
  short: "#f0883e",
  working: "#58a6ff",
  semantic: "#a371f7",
  observation: "#3fb950",
};

const TIER_ICONS: Record<string, string> = {
  short: "⚡",
  working: "📋",
  semantic: "🧠",
  observation: "👁",
};

export function MemoryViewer({ agentName }: MemoryViewerProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agents/${encodeURIComponent(agentName)}/memory`)
      .then((r) => { if (!r.ok) throw new Error("HTTP error"); return r.json(); })
      .then((data) => { if (!cancelled) { setEntries(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentName]);

  const refreshMemory = () => {
    fetch(`/api/agents/${encodeURIComponent(agentName)}/memory`)
      .then((r) => { if (!r.ok) throw new Error("HTTP error"); return r.json(); })
      .then((data) => setEntries(data))
      .catch(() => {});
  };

  if (loading) return <div style={{ padding: 16, color: "#8b949e" }}>Loading memory...</div>;

  const filtered = filter === "all" ? entries : entries.filter((e) => e.tier === filter);
  const tierCounts = entries.reduce((acc, e) => { acc[e.tier] = (acc[e.tier] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: "#58a6ff" }}>🧠 Memory ({entries.length} entries)</h3>
        <button
          onClick={refreshMemory}
          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #30363d", background: "transparent", color: "#58a6ff", cursor: "pointer", fontSize: 12 }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tier filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "4px 10px", borderRadius: 12, border: "1px solid #30363d",
            background: filter === "all" ? "#30363d" : "transparent",
            color: "#c9d1d9", cursor: "pointer", fontSize: 12,
          }}
        >
          All ({entries.length})
        </button>
        {(["short", "working", "semantic", "observation"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setFilter(tier)}
            style={{
              padding: "4px 10px", borderRadius: 12, border: `1px solid ${TIER_COLORS[tier]}40`,
              background: filter === tier ? `${TIER_COLORS[tier]}20` : "transparent",
              color: TIER_COLORS[tier], cursor: "pointer", fontSize: 12,
            }}
          >
            {TIER_ICONS[tier]} {tier} ({tierCounts[tier] || 0})
          </button>
        ))}
      </div>

      {/* Memory entries */}
      {filtered.length === 0 ? (
        <div style={{ color: "#8b949e", fontSize: 13, padding: 8 }}>No memory entries</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((entry, i) => (
            <div
              key={`${entry.key}-${i}`}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${TIER_COLORS[entry.tier]}30`,
                background: "#161b22",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#c9d1d9" }}>
                  {TIER_ICONS[entry.tier]} {entry.key}
                </span>
                <span style={{ fontSize: 11, color: TIER_COLORS[entry.tier] }}>
                  {entry.tier}
                </span>
              </div>
              <pre style={{ fontSize: 12, color: "#8b949e", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
                {typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value, null, 2)}
              </pre>
              <div style={{ fontSize: 10, color: "#484f58", marginTop: 4 }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
