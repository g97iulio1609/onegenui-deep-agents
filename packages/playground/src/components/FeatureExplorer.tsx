import { useState } from "react";
import { useChat, useCompletion, useAgent } from "@gauss-ai/chat";
import { ChatPanel, ChatInput, StreamingIndicator, ToolCallViewer, AgentSelector } from "@gauss-ai/react";
import type { GaussTheme, ToolCallViewerProps } from "@gauss-ai/react";
import type { ToolCallPart } from "@gauss-ai/chat";

type Feature =
  | "useChat"
  | "useCompletion"
  | "useAgent"
  | "ChatPanel"
  | "ChatInput"
  | "ToolCallViewer"
  | "AgentSelector"
  | "StreamingIndicator"
  | "Theming";

interface FeatureInfo {
  id: Feature;
  label: string;
  description: string;
  package: string;
}

const features: FeatureInfo[] = [
  { id: "useChat", label: "useChat Hook", description: "Multi-turn chat with streaming", package: "@gauss-ai/chat" },
  { id: "useCompletion", label: "useCompletion Hook", description: "Single-turn completions", package: "@gauss-ai/chat" },
  { id: "useAgent", label: "useAgent Hook", description: "Agent-specific with memory", package: "@gauss-ai/chat" },
  { id: "ChatPanel", label: "<ChatPanel />", description: "Full chat interface", package: "@gauss-ai/react" },
  { id: "ChatInput", label: "<ChatInput />", description: "Input with send/stop", package: "@gauss-ai/react" },
  { id: "ToolCallViewer", label: "<ToolCallViewer />", description: "Tool call visualization", package: "@gauss-ai/react" },
  { id: "AgentSelector", label: "<AgentSelector />", description: "Agent picker dropdown", package: "@gauss-ai/react" },
  { id: "StreamingIndicator", label: "<StreamingIndicator />", description: "Typing animation", package: "@gauss-ai/react" },
  { id: "Theming", label: "Theming System", description: "Customizable themes", package: "@gauss-ai/react" },
];

const darkTheme: GaussTheme = {
  primaryColor: "#58a6ff",
  backgroundColor: "#0d1117",
  userBubbleColor: "#1f6feb",
  assistantBubbleColor: "#21262d",
  textColor: "#c9d1d9",
  borderRadius: "12px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

export function FeatureExplorer() {
  const [selected, setSelected] = useState<Feature>("useChat");

  return (
    <div style={{ display: "flex", height: "100%", background: "#0d1117" }}>
      {/* Feature list sidebar */}
      <div style={{ width: 260, borderRight: "1px solid #30363d", padding: 12, overflowY: "auto" }}>
        <h3 style={{ fontSize: 13, color: "#58a6ff", marginBottom: 12, textTransform: "uppercase" }}>
          📦 Features
        </h3>
        {features.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 12px",
              marginBottom: 4,
              border: "none",
              borderRadius: 6,
              background: selected === f.id ? "#1f6feb22" : "transparent",
              color: selected === f.id ? "#58a6ff" : "#8b949e",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600 }}>{f.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{f.description}</div>
          </button>
        ))}
      </div>

      {/* Feature demo area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #30363d" }}>
          <span style={{ color: "#c9d1d9", fontWeight: 600, fontSize: 14 }}>
            {features.find((f) => f.id === selected)?.label}
          </span>
          <span style={{ color: "#8b949e", fontSize: 12, marginLeft: 8 }}>
            from {features.find((f) => f.id === selected)?.package}
          </span>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          <FeatureDemo feature={selected} />
        </div>
      </div>
    </div>
  );
}

function FeatureDemo({ feature }: { feature: Feature }) {
  switch (feature) {
    case "useChat":
      return <UseChatDemo />;
    case "useCompletion":
      return <UseCompletionDemo />;
    case "useAgent":
      return <UseAgentDemo />;
    case "ChatPanel":
      return <ChatPanelDemo />;
    case "ChatInput":
      return <ChatInputDemo />;
    case "ToolCallViewer":
      return <ToolCallViewerDemo />;
    case "AgentSelector":
      return <AgentSelectorDemo />;
    case "StreamingIndicator":
      return <StreamingIndicatorDemo />;
    case "Theming":
      return <ThemingDemo />;
  }
}

function UseChatDemo() {
  const chat = useChat({ api: "/api/chat" });
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CodeSnippet code={`const { messages, sendMessage, status, stop } = useChat({
  api: "/api/chat",
});`} />
      <div style={{ flex: 1 }}>
        <ChatPanel {...chat} onSend={(t) => chat.sendMessage(t)} onStop={chat.stop} theme={darkTheme} />
      </div>
    </div>
  );
}

function UseCompletionDemo() {
  const { completion, complete, status, stop, isLoading } = useCompletion({ api: "/api/chat" });
  const [prompt, setPrompt] = useState("");

  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`const { completion, complete, isLoading } = useCompletion({
  api: "/api/completion",
});`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt..."
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt) complete(prompt); }}
        />
        <button
          onClick={() => prompt && complete(prompt)}
          disabled={isLoading}
          style={buttonStyle}
        >
          {isLoading ? "Generating..." : "Complete"}
        </button>
        {isLoading && <button onClick={stop} style={{ ...buttonStyle, background: "#f85149" }}>Stop</button>}
      </div>
      {completion && (
        <div style={{ background: "#161b22", borderRadius: 8, padding: 12, color: "#c9d1d9", whiteSpace: "pre-wrap" }}>
          {completion}
        </div>
      )}
      <div style={{ color: "#8b949e", fontSize: 12, marginTop: 8 }}>Status: {status}</div>
    </div>
  );
}

function UseAgentDemo() {
  const agents = [
    { id: "assistant", name: "Assistant" },
    { id: "code-reviewer", name: "Code Reviewer" },
    { id: "writer", name: "Writer" },
  ];
  const { messages, sendMessage, status, stop, agent, setAgent } = useAgent({
    api: "/api/chat",
    agent: "assistant",
    enableMemory: true,
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CodeSnippet code={`const { messages, sendMessage, agent, setAgent } = useAgent({
  api: "/api/agent",
  agent: "assistant",
  enableMemory: true,
});`} />
      <div style={{ flex: 1 }}>
        <ChatPanel
          messages={messages}
          onSend={(t) => sendMessage(t)}
          status={status}
          onStop={stop}
          theme={darkTheme}
          header={
            <AgentSelector agents={agents} selectedAgent={agent} onSelect={setAgent} />
          }
        />
      </div>
    </div>
  );
}

function ChatPanelDemo() {
  const chat = useChat({ api: "/api/chat" });
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CodeSnippet code={`<ChatPanel
  messages={messages}
  onSend={(text) => sendMessage(text)}
  status={status}
  onStop={stop}
  theme={darkTheme}
  header={<h3>My Chat</h3>}
/>`} />
      <div style={{ flex: 1 }}>
        <ChatPanel
          {...chat}
          onSend={(t) => chat.sendMessage(t)}
          onStop={chat.stop}
          theme={darkTheme}
          header={<span style={{ color: "#c9d1d9", fontWeight: 600 }}>💬 ChatPanel Demo</span>}
        />
      </div>
    </div>
  );
}

function ChatInputDemo() {
  const [lastSent, setLastSent] = useState<string | null>(null);
  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`<ChatInput
  onSend={(text) => handleSend(text)}
  status="idle"
  placeholder="Type here..."
/>`} />
      <div style={{ maxWidth: 500 }}>
        <ChatInput onSend={(t) => setLastSent(t)} placeholder="Try typing and pressing Enter..." />
      </div>
      {lastSent && (
        <div style={{ marginTop: 12, color: "#8b949e", fontSize: 13 }}>
          Last sent: <strong style={{ color: "#c9d1d9" }}>{lastSent}</strong>
        </div>
      )}
    </div>
  );
}

function ToolCallViewerDemo() {
  const demoToolCalls: ToolCallPart[] = [
    { type: "tool-call", toolName: "web_search", toolCallId: "tc-001", args: { query: "Gauss AI framework" } },
    { type: "tool-call", toolName: "calculator", toolCallId: "tc-002", args: { expression: "42 * 1337" } },
  ];
  const demoResults: ToolCallViewerProps["toolResults"] = [
    { type: "tool-result", toolCallId: "tc-001", result: { title: "Gauss - AI Agent Framework", url: "https://gauss.ai" } },
    { type: "tool-result", toolCallId: "tc-002", result: 56154 },
  ];
  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`<ToolCallViewer
  toolCalls={message.parts.filter(p => p.type === "tool-call")}
  toolResults={message.parts.filter(p => p.type === "tool-result")}
/>`} />
      <ToolCallViewer toolCalls={demoToolCalls} toolResults={demoResults} />
    </div>
  );
}

function AgentSelectorDemo() {
  const [selected, setSelected] = useState("assistant");
  const agents = [
    { id: "assistant", name: "General Assistant", description: "Multi-purpose AI" },
    { id: "coder", name: "Code Expert", description: "Programming specialist" },
    { id: "writer", name: "Content Writer", description: "Creative writing" },
  ];
  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`<AgentSelector
  agents={agents}
  selectedAgent={selectedAgent}
  onSelect={(id) => setAgent(id)}
/>`} />
      <AgentSelector agents={agents} selectedAgent={selected} onSelect={setSelected} />
      <div style={{ marginTop: 12, color: "#8b949e", fontSize: 13 }}>
        Selected: <strong style={{ color: "#c9d1d9" }}>{selected}</strong>
      </div>
    </div>
  );
}

function StreamingIndicatorDemo() {
  const [isStreaming, setIsStreaming] = useState(true);
  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`<StreamingIndicator
  isStreaming={status === "streaming"}
  text="Thinking"
/>`} />
      <button onClick={() => setIsStreaming(!isStreaming)} style={buttonStyle}>
        {isStreaming ? "Stop" : "Start"} Streaming
      </button>
      <div style={{ marginTop: 16 }}>
        <StreamingIndicator isStreaming={isStreaming} text="Thinking" />
      </div>
    </div>
  );
}

function ThemingDemo() {
  const [primaryColor, setPrimaryColor] = useState("#58a6ff");
  const chat = useChat({ api: "/api/chat" });
  const theme: GaussTheme = {
    ...darkTheme,
    primaryColor,
    userBubbleColor: primaryColor,
  };
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "#8b949e", fontSize: 13 }}>Primary Color:</span>
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          style={{ width: 32, height: 32, border: "none", cursor: "pointer" }}
        />
        <code style={{ color: "#c9d1d9", fontSize: 12 }}>{primaryColor}</code>
      </div>
      <div style={{ flex: 1 }}>
        <ChatPanel
          {...chat}
          onSend={(t) => chat.sendMessage(t)}
          onStop={chat.stop}
          theme={theme}
          header={<span style={{ color: "#c9d1d9" }}>🎨 Themed Chat</span>}
        />
      </div>
    </div>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <pre style={{
      background: "#161b22",
      border: "1px solid #30363d",
      borderRadius: 8,
      padding: "10px 14px",
      margin: "8px 16px",
      fontSize: 12,
      color: "#79c0ff",
      overflow: "auto",
      fontFamily: "'SF Mono', 'Fira Code', monospace",
    }}>
      {code}
    </pre>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #30363d",
  background: "#0d1117",
  color: "#c9d1d9",
  fontSize: 13,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "#238636",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
};
