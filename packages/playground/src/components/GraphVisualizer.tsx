import { useState, useEffect, useRef, useCallback } from "react";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphVisualizerProps {
  agentName: string;
}

// Simple force-directed layout simulation
interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_COLORS: Record<string, string> = {
  PERSON: "#58a6ff",
  ORG: "#f0883e",
  CHUNK: "#484f58",
  EMAIL: "#a371f7",
  DATE: "#3fb950",
  URL: "#d2a8ff",
  DEFAULT: "#8b949e",
};

function getNodeColor(type: string): string {
  return NODE_COLORS[type] ?? NODE_COLORS.DEFAULT;
}

export function GraphVisualizer({ agentName }: GraphVisualizerProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showChunks, setShowChunks] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initPositions = useCallback((graphData: GraphData) => {
    const pos = new Map<string, NodePosition>();
    const cx = 400, cy = 300;
    graphData.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length;
      const radius = 150 + Math.random() * 100;
      pos.set(node.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0, vy: 0,
      });
    });
    // Run simple force simulation (50 iterations)
    for (let iter = 0; iter < 50; iter++) {
      // Repulsion
      for (const [id1, p1] of pos) {
        for (const [id2, p2] of pos) {
          if (id1 === id2) continue;
          const dx = p1.x - p2.x, dy = p1.y - p2.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 5000 / (dist * dist);
          p1.vx += (dx / dist) * force;
          p1.vy += (dy / dist) * force;
        }
      }
      // Attraction
      for (const edge of graphData.edges) {
        const p1 = pos.get(edge.source), p2 = pos.get(edge.target);
        if (!p1 || !p2) continue;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = dist * 0.01;
        p1.vx += (dx / dist) * force;
        p1.vy += (dy / dist) * force;
        p2.vx -= (dx / dist) * force;
        p2.vy -= (dy / dist) * force;
      }
      // Apply velocity + damping + center gravity
      for (const [, p] of pos) {
        p.vx *= 0.8; p.vy *= 0.8;
        p.x += p.vx; p.y += p.vy;
        p.x += (cx - p.x) * 0.01;
        p.y += (cy - p.y) * 0.01;
      }
    }
    setPositions(pos);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agents/${encodeURIComponent(agentName)}/graph`)
      .then((r) => { if (!r.ok) throw new Error("HTTP error"); return r.json(); })
      .then((graphData: GraphData) => {
        if (!cancelled) {
          setData(graphData);
          initPositions(graphData);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentName, initPositions]);

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || positions.size === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const filteredNodes = showChunks ? data.nodes : data.nodes.filter((n) => n.type !== "CHUNK");
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    for (const edge of filteredEdges) {
      const p1 = positions.get(edge.source), p2 = positions.get(edge.target);
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
        ? "#58a6ff"
        : "#30363d";
      ctx.lineWidth = Math.min(edge.weight * 2, 3);
      ctx.stroke();
      // Edge label
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      if (edge.type !== "MENTIONED_IN") {
        ctx.fillStyle = "#484f58";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(edge.type, mx, my - 4);
      }
    }

    // Draw nodes
    for (const node of filteredNodes) {
      const p = positions.get(node.id);
      if (!p) continue;
      const r = hoveredNode === node.id ? 10 : 7;
      const color = getNodeColor(node.type);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = hoveredNode === node.id ? "#fff" : "#0d1117";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Label
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.label, p.x, p.y + r + 14);
    }
  }, [data, positions, hoveredNode, showChunks]);

  // Mouse hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let found: string | null = null;
    for (const node of data.nodes) {
      const p = positions.get(node.id);
      if (!p) continue;
      const dx = mx - p.x, dy = my - p.y;
      if (dx * dx + dy * dy < 100) { found = node.id; break; }
    }
    setHoveredNode(found);
  }, [data.nodes, positions]);

  if (loading) return <div style={{ padding: 16, color: "#8b949e" }}>Loading graph...</div>;
  if (data.nodes.length === 0) return <div style={{ padding: 16, color: "#8b949e" }}>No knowledge graph data</div>;

  const entityCount = data.nodes.filter((n) => n.type !== "CHUNK").length;
  const edgeCount = data.edges.filter((e) => e.type !== "MENTIONED_IN").length;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: "#58a6ff" }}>🕸 Knowledge Graph ({entityCount} entities, {edgeCount} relations)</h3>
        <label style={{ fontSize: 12, color: "#8b949e", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showChunks}
            onChange={(e) => setShowChunks(e.target.checked)}
            style={{ marginRight: 4 }}
          />
          Show chunks
        </label>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        {Object.entries(NODE_COLORS).filter(([k]) => k !== "DEFAULT").map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ color: "#8b949e" }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseMove={handleMouseMove}
        style={{
          width: "100%",
          maxWidth: 800,
          border: "1px solid #30363d",
          borderRadius: 8,
          background: "#0d1117",
          cursor: hoveredNode ? "pointer" : "default",
        }}
      />

      {/* Hovered node details */}
      {hoveredNode && (() => {
        const node = data.nodes.find((n) => n.id === hoveredNode);
        if (!node) return null;
        return (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "#161b22", borderRadius: 8, border: "1px solid #30363d" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: getNodeColor(node.type) }}>
              {node.label} <span style={{ fontSize: 11, color: "#8b949e" }}>({node.type})</span>
            </div>
            {Object.keys(node.properties).length > 0 && (
              <pre style={{ fontSize: 11, color: "#8b949e", margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(node.properties, null, 2)}
              </pre>
            )}
          </div>
        );
      })()}
    </div>
  );
}
