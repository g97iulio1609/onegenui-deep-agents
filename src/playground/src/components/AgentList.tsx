import React from "react";
import type { AgentInfo } from "../hooks/useAgent.js";

export interface AgentListProps {
  agents: AgentInfo[];
  selectedId: string | null;
  onSelect: (agent: AgentInfo) => void;
}

export function AgentList({ agents, selectedId, onSelect }: AgentListProps): React.JSX.Element {
  if (agents.length === 0) {
    return (
      <div className="pg-agent-list-empty">
        <p>No agents available</p>
      </div>
    );
  }

  return (
    <div className="pg-agent-list">
      {agents.map((agent) => (
        <button
          key={agent.id}
          className={`pg-agent-card ${selectedId === agent.id ? "pg-agent-card--active" : ""}`}
          onClick={() => onSelect(agent)}
        >
          <div className="pg-agent-card-name">{agent.name}</div>
          {agent.description && (
            <div className="pg-agent-card-desc">{agent.description}</div>
          )}
          <div className="pg-agent-card-tools">
            {agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}
          </div>
        </button>
      ))}
    </div>
  );
}
