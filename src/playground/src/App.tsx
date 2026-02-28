import React, { useState, useCallback } from "react";
import { AgentList } from "./components/AgentList.js";
import { ChatPanel } from "./components/ChatPanel.js";
import { ToolInspector } from "./components/ToolInspector.js";
import { ExecutionTimeline } from "./components/ExecutionTimeline.js";
import { useAgent, type AgentInfo, type TimelineEntry, type ToolCall } from "./hooks/useAgent.js";

export function App(): React.JSX.Element {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const { agents, messages, timeline, isStreaming, lastToolCall, sendMessage } = useAgent();

  const handleSelectAgent = useCallback((agent: AgentInfo) => {
    setSelectedAgent(agent);
    setSelectedTool(null);
  }, []);

  const handleSend = useCallback(
    (prompt: string) => {
      if (selectedAgent) sendMessage(selectedAgent.id, prompt);
    },
    [selectedAgent, sendMessage],
  );

  const currentToolCall = selectedTool
    ? lastToolCall.get(selectedTool) ?? null
    : null;

  const currentTools = selectedAgent?.tools ?? [];

  return (
    <div className="pg-app">
      <aside className="pg-sidebar">
        <div className="pg-logo">
          <h1>⚡ Gauss Playground</h1>
        </div>
        <AgentList
          agents={agents}
          selectedId={selectedAgent?.id ?? null}
          onSelect={handleSelectAgent}
        />
      </aside>
      <main className="pg-main">
        {selectedAgent ? (
          <>
            <div className="pg-chat-area">
              <ChatPanel
                agentName={selectedAgent.name}
                messages={messages}
                isStreaming={isStreaming}
                onSend={handleSend}
              />
            </div>
            <div className="pg-inspector-area">
              <ExecutionTimeline entries={timeline} />
              <ToolInspector
                tools={currentTools}
                selectedTool={selectedTool}
                lastCall={currentToolCall}
                onSelectTool={setSelectedTool}
              />
            </div>
          </>
        ) : (
          <div className="pg-empty-state">
            <h2>Select an agent to begin</h2>
            <p>Choose an agent from the sidebar to start a conversation.</p>
          </div>
        )}
      </main>
    </div>
  );
}
