import type { ToolCall, ToolInfo } from '../types';
import { CodeBlock } from './CodeBlock';

interface ToolInspectorProps {
  tools: ToolInfo[];
  selectedTool: string | null;
  lastCall: ToolCall | null;
  onSelectTool: (name: string | null) => void;
}

export function ToolInspector({ tools, selectedTool, lastCall, onSelectTool }: ToolInspectorProps) {
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
            className={`pg-tool-item ${selectedTool === tool.name ? 'pg-tool-item--active' : ''}`}
            onClick={() => onSelectTool(selectedTool === tool.name ? null : tool.name)}
            title={tool.description}
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
              <CodeBlock code={JSON.stringify(selected.schema, null, 2)} language="json" />
            </div>
          )}
          {lastCall && (
            <div className="pg-tool-last-call">
              <strong>Last Call:</strong>
              <CodeBlock code={JSON.stringify({ args: lastCall.args, result: lastCall.result, durationMs: lastCall.durationMs }, null, 2)} language="json" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
