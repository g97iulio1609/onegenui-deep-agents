import { useAgent } from "@gauss-ai/chat";
import { ChatPanel, AgentSelector } from "@gauss-ai/react";
import type { GaussTheme } from "@gauss-ai/react";

interface AgentChatProps {
  agentName: string;
  agents?: Array<{ id: string; name: string; description?: string }>;
}

const darkTheme: GaussTheme = {
  primaryColor: "#58a6ff",
  backgroundColor: "#0d1117",
  userBubbleColor: "#1f6feb",
  assistantBubbleColor: "#21262d",
  textColor: "#c9d1d9",
  borderRadius: "12px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

export function AgentChat({ agentName, agents = [] }: AgentChatProps) {
  const { messages, sendMessage, status, stop, agent, setAgent } = useAgent({
    api: "/api/chat",
    agent: agentName,
    enableMemory: true,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ChatPanel
        messages={messages}
        onSend={(text) => sendMessage(text)}
        status={status}
        onStop={stop}
        theme={darkTheme}
        header={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 16, color: "#c9d1d9" }}>
              {agent ?? agentName}
            </span>
            {agents.length > 1 && (
              <AgentSelector
                agents={agents}
                selectedAgent={agent}
                onSelect={setAgent}
              />
            )}
          </div>
        }
      />
    </div>
  );
}
