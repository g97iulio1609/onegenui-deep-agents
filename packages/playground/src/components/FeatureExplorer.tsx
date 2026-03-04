import { useState, useCallback, useMemo } from "react";
import { useChat, useCompletion, useAgent } from "@gauss-ai/chat";
import { applyMiddleware, retryMiddleware, loggingMiddleware, rateLimitMiddleware, hooksMiddleware } from "@gauss-ai/chat";
import { ChatPanel, ChatInput, StreamingIndicator, ToolCallViewer, AgentSelector, ConversationList, SyntaxHighlighter } from "@gauss-ai/react";
import type { GaussTheme, ToolCallViewerProps, ConversationItem } from "@gauss-ai/react";
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
  | "Theming"
  | "Middleware"
  | "ConversationList"
  | "SyntaxHighlighter";

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
  { id: "Middleware", label: "Middleware System", description: "Composable transport middleware", package: "@gauss-ai/chat" },
  { id: "ConversationList", label: "<ConversationList />", description: "Conversation history sidebar", package: "@gauss-ai/react" },
  { id: "SyntaxHighlighter", label: "<SyntaxHighlighter />", description: "Zero-dep code highlighting", package: "@gauss-ai/react" },
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
    case "Middleware":
      return <MiddlewareDemo />;
    case "ConversationList":
      return <ConversationListDemo />;
    case "SyntaxHighlighter":
      return <SyntaxHighlighterDemo />;
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

function MiddlewareDemo() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`import { applyMiddleware, retryMiddleware, loggingMiddleware, rateLimitMiddleware, hooksMiddleware } from "@gauss-ai/chat";

const enhancedTransport = applyMiddleware(baseTransport, [
  retryMiddleware({ maxRetries: 3, baseDelay: 1000 }),
  loggingMiddleware({ logger: console }),
  rateLimitMiddleware({ maxRequests: 60, windowMs: 60_000 }),
  hooksMiddleware({
    beforeSend: (msgs) => console.log("Sending", msgs.length, "messages"),
    onComplete: () => console.log("Stream complete"),
  }),
]);`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          style={buttonStyle}
          onClick={() => {
            addLog("🔄 retryMiddleware: 3 retries, 1s base delay, 0.2 jitter");
            addLog("   Retryable statuses: 408, 429, 500, 502, 503, 504");
          }}
        >
          Retry Demo
        </button>
        <button
          style={buttonStyle}
          onClick={() => {
            addLog("📝 loggingMiddleware: request logged");
            addLog("   → POST /api/chat (3 messages)");
            addLog("   ← event: text-delta");
            addLog("   ✓ completed in 842ms");
          }}
        >
          Logging Demo
        </button>
        <button
          style={buttonStyle}
          onClick={() => {
            addLog("⏱️ rateLimitMiddleware: 58/60 requests remaining");
            addLog("   Window: 60s, resets in 42s");
          }}
        >
          Rate Limit Demo
        </button>
        <button
          style={buttonStyle}
          onClick={() => {
            addLog("🪝 hooksMiddleware: beforeSend fired");
            addLog("   → onEvent: text-delta (12 chars)");
            addLog("   → onComplete: stream finished");
          }}
        >
          Hooks Demo
        </button>
        <button
          style={{ ...buttonStyle, background: "#f85149" }}
          onClick={() => setLogs([])}
        >
          Clear
        </button>
      </div>
      <div style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 8,
        padding: 12,
        minHeight: 200,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 12,
        color: "#8b949e",
        overflow: "auto",
      }}>
        {logs.length === 0 ? (
          <span style={{ opacity: 0.5 }}>Click a button above to see middleware in action...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: 2, color: log.includes("✓") ? "#3fb950" : log.includes("→") ? "#79c0ff" : "#c9d1d9" }}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ConversationListDemo() {
  const demoConversations: ConversationItem[] = useMemo(() => [
    { id: "c1", title: "Building a REST API", lastMessage: "Here's the Express setup...", updatedAt: new Date(Date.now() - 120000), agentId: "coder" },
    { id: "c2", title: "React Best Practices", lastMessage: "Use useMemo for expensive computations", updatedAt: new Date(Date.now() - 3600000), agentId: "assistant" },
    { id: "c3", title: "Debugging Memory Leak", lastMessage: "Check the useEffect cleanup...", updatedAt: new Date(Date.now() - 86400000), agentId: "coder" },
    { id: "c4", title: "Write a Blog Post", lastMessage: "Introduction paragraph drafted", updatedAt: new Date(Date.now() - 172800000), agentId: "writer" },
    { id: "c5", title: "Rust Ownership Model", lastMessage: "The borrow checker ensures...", updatedAt: new Date(Date.now() - 604800000) },
  ], []);

  const [selectedId, setSelectedId] = useState<string | undefined>("c1");
  const [deleted, setDeleted] = useState<string[]>([]);

  const visibleConversations = useMemo(
    () => demoConversations.filter((c) => !deleted.includes(c.id)),
    [demoConversations, deleted],
  );

  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`<ConversationList
  conversations={conversations}
  selectedId={selectedId}
  onSelect={(id) => setSelectedId(id)}
  onDelete={(id) => handleDelete(id)}
/>`} />
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 300, border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
          <ConversationList
            conversations={visibleConversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={(id) => setDeleted((prev) => [...prev, id])}
          />
        </div>
        <div style={{ flex: 1, color: "#8b949e", fontSize: 13 }}>
          <div>Selected: <strong style={{ color: "#c9d1d9" }}>{selectedId ?? "none"}</strong></div>
          <div>Deleted: <strong style={{ color: "#f85149" }}>{deleted.length}</strong></div>
          {deleted.length > 0 && (
            <button style={{ ...buttonStyle, marginTop: 8 }} onClick={() => setDeleted([])}>
              Restore All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SyntaxHighlighterDemo() {
  const [language, setLanguage] = useState<"javascript" | "typescript" | "python" | "rust">("typescript");
  const [themeName, setThemeName] = useState<"dark" | "light">("dark");

  const codeExamples: Record<string, string> = useMemo(() => ({
    javascript: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Usage
const result = fibonacci(10);
console.log(\`Fibonacci(10) = \${result}\`);`,
    typescript: `interface Agent {
  id: string;
  name: string;
  model: "gpt-4" | "claude-3";
  tools: Tool[];
}

async function runAgent(agent: Agent, prompt: string): Promise<string> {
  const response = await fetch("/api/agent", {
    method: "POST",
    body: JSON.stringify({ agentId: agent.id, prompt }),
  });
  return response.json();
}`,
    python: `from gauss import Agent, Tool

class SearchTool(Tool):
    """Web search tool for agents."""
    
    async def execute(self, query: str) -> dict:
        results = await self.client.search(query)
        return {"results": results[:5]}

agent = Agent(
    name="researcher",
    model="gpt-4",
    tools=[SearchTool()],
)`,
    rust: `use gauss_core::{Agent, Runtime, Tool};

#[derive(Debug)]
struct Calculator;

impl Tool for Calculator {
    fn name(&self) -> &str { "calculator" }
    
    async fn execute(&self, input: &str) -> Result<String, Error> {
        let result: f64 = input.parse()?;
        Ok(format!("Result: {}", result * 2.0))
    }
}

fn main() {
    let agent = Agent::builder()
        .name("math-agent")
        .tool(Calculator)
        .build();
}`,
  }), []);

  return (
    <div style={{ padding: 16 }}>
      <CodeSnippet code={`import { SyntaxHighlighter } from "@gauss-ai/react";

<SyntaxHighlighter
  code={code}
  language="typescript"
  theme="dark"
/>`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["javascript", "typescript", "python", "rust"] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            style={{
              ...buttonStyle,
              background: language === lang ? "#1f6feb" : "#21262d",
            }}
          >
            {lang}
          </button>
        ))}
        <button
          onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")}
          style={{ ...buttonStyle, background: "#6e40c9" }}
        >
          {themeName === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
      <SyntaxHighlighter
        code={codeExamples[language]}
        language={language}
        theme={themeName}
      />
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
