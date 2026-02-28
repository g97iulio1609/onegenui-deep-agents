import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../hooks/useAgent.js";

export interface ChatPanelProps {
  agentName: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (prompt: string) => void;
}

export function ChatPanel({ agentName, messages, isStreaming, onSend }: ChatPanelProps): React.JSX.Element {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    onSend(trimmed);
  };

  return (
    <div className="pg-chat">
      <div className="pg-chat-header">
        <h2>{agentName}</h2>
        {isStreaming && <span className="pg-streaming-indicator">● Streaming...</span>}
      </div>

      <div className="pg-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`pg-message pg-message--${msg.role}`}>
            <div className="pg-message-role">{msg.role === "user" ? "You" : agentName}</div>
            <div className="pg-message-content">
              {msg.content}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="pg-tool-calls">
                  {msg.toolCalls.map((tc, j) => (
                    <ToolCallBlock key={j} name={tc.name} args={tc.args} result={tc.result} durationMs={tc.durationMs} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="pg-chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isStreaming}
          autoFocus
        />
        <button type="submit" disabled={isStreaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function ToolCallBlock({ name, args, result, durationMs }: {
  name: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pg-tool-call">
      <button className="pg-tool-call-header" onClick={() => setExpanded(!expanded)}>
        <span className="pg-tool-call-icon">{expanded ? "▼" : "▶"}</span>
        <span className="pg-tool-call-name">🔧 {name}</span>
        {durationMs != null && <span className="pg-tool-call-duration">{durationMs}ms</span>}
      </button>
      {expanded && (
        <div className="pg-tool-call-body">
          <div className="pg-tool-call-section">
            <strong>Args:</strong>
            <pre>{JSON.stringify(args, null, 2)}</pre>
          </div>
          {result !== undefined && (
            <div className="pg-tool-call-section">
              <strong>Result:</strong>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
