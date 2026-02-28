import React from "react";
import type { ToolCall } from "../hooks/useAgent.js";

export interface ToolInfo {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface ToolInspectorProps {
  tools: ToolInfo[];
  selectedTool: string | null;
  lastCall: ToolCall | null;
  onSelectTool: (name: string | null) => void;
}

export function ToolInspector({ tools, selectedTool, lastCall, onSelectTool }: ToolInspectorProps): React.JSX.Element {
  if (tools.length === 0) {
    return (
      <div className="pg-tool-inspector">
        <h3>Tools</h3>
        <p className="pg-muted">No tools registered</p>
      </div>
    );
  }

  const selected = tools.find((t) => t.name === selectedTool);

  return (
    <div className="pg-tool-inspector">
      <h3>Tools</h3>
      <div className="pg-tool-list">
        {tools.map((tool) => (
          <button
            key={tool.name}
            className={`pg-tool-item ${selectedTool === tool.name ? "pg-tool-item--active" : ""}`}
            onClick={() => onSelectTool(selectedTool === tool.name ? null : tool.name)}
          >
            🔧 {tool.name}
          </button>
        ))}
      </div>

      {selected && (
        <div className="pg-tool-detail">
          <h4>{selected.name}</h4>
          {selected.description && <p>{selected.description}</p>}
          {selected.schema && (
            <div className="pg-tool-schema">
              <strong>Schema:</strong>
              <pre>{JSON.stringify(selected.schema, null, 2)}</pre>
            </div>
          )}
          {lastCall && (
            <div className="pg-tool-last-call">
              <strong>Last Call:</strong>
              <pre>{JSON.stringify({ args: lastCall.args, result: lastCall.result, durationMs: lastCall.durationMs }, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
