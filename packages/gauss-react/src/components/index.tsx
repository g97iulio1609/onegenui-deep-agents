import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatStatus } from "@gauss-ai/chat";
import { getMessageText } from "@gauss-ai/chat";
import type { GaussTheme } from "../theme.js";
import { themeToVars } from "../theme.js";
import { MarkdownRenderer } from "./markdown-renderer.js";

export interface ChatInputProps {
  /** Callback when user submits a message. */
  onSend: (text: string) => void;
  /** Current chat status — disables input during loading. */
  status?: ChatStatus;
  /** Placeholder text. */
  placeholder?: string;
  /** Show stop button during streaming. */
  onStop?: () => void;
  /** Custom class name. */
  className?: string;
  /** Disable the input. */
  disabled?: boolean;
  /** Slot rendered before the textarea (e.g., file attach button). */
  inputStartSlot?: React.ReactNode;
  /** Slot rendered after the send button (e.g., voice input). */
  inputEndSlot?: React.ReactNode;
}

/** Chat input with send button and optional stop button. */
export function ChatInput({
  onSend,
  status = "idle",
  placeholder = "Type a message...",
  onStop,
  className,
  disabled,
  inputStartSlot,
  inputEndSlot,
}: ChatInputProps): React.JSX.Element {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isActive = status === "loading" || status === "streaming";

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isActive) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  }, [value, isActive, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={className} data-testid="gauss-chat-input" style={inputContainerStyle}>
      {inputStartSlot}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isActive}
        data-testid="gauss-chat-textarea"
        rows={1}
        style={textareaStyle}
      />
      {isActive && onStop ? (
        <button
          onClick={onStop}
          data-testid="gauss-stop-button"
          style={stopButtonStyle}
          type="button"
        >
          ■
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isActive || disabled}
          data-testid="gauss-send-button"
          style={sendButtonStyle}
          type="button"
        >
          ↑
        </button>
      )}
      {inputEndSlot}
    </div>
  );
}

export interface StreamingIndicatorProps {
  /** Whether currently streaming. */
  isStreaming: boolean;
  /** Custom text to show. */
  text?: string;
  /** Custom class name. */
  className?: string;
}

/** Animated typing/thinking indicator. */
export function StreamingIndicator({
  isStreaming,
  text = "Thinking",
  className,
}: StreamingIndicatorProps): React.JSX.Element | null {
  if (!isStreaming) return null;

  return (
    <div className={className} data-testid="gauss-streaming-indicator" style={indicatorStyle}>
      <span>{text}</span>
      <span style={dotsStyle}>
        <span style={dotStyle}>.</span>
        <span style={{ ...dotStyle, animationDelay: "0.2s" }}>.</span>
        <span style={{ ...dotStyle, animationDelay: "0.4s" }}>.</span>
      </span>
    </div>
  );
}

export interface MessageListProps {
  /** Messages to display. */
  messages: ChatMessage[];
  /** Custom class name. */
  className?: string;
  /** Custom theme. */
  theme?: GaussTheme;
  /** Custom message renderer. */
  renderMessage?: (message: ChatMessage, index: number) => React.ReactNode;
  /** Render assistant messages as Markdown. Default: false. */
  markdown?: boolean;
}

/** Scrollable list of chat messages. */
export function MessageList({
  messages,
  className,
  theme,
  renderMessage,
  markdown = false,
}: MessageListProps): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null);
  const vars = theme ? themeToVars(theme) : {};

  const renderedMessages = useMemo(
    () =>
      messages.map((message, index) =>
        renderMessage ? (
          <React.Fragment key={message.id}>
            {renderMessage(message, index)}
          </React.Fragment>
        ) : (
          <MessageBubble key={message.id} message={message} markdown={markdown} />
        ),
      ),
    [messages, renderMessage, markdown],
  );

  return (
    <div
      className={className}
      data-testid="gauss-message-list"
      style={{ ...messageListStyle, ...vars } as React.CSSProperties}
    >
      {renderedMessages}
      <div ref={endRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  markdown?: boolean;
}

function MessageBubble({ message, markdown = false }: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  const toolCalls = message.parts.filter((p) => p.type === "tool-call");
  const useMarkdown = markdown && !isUser && text;

  return (
    <div
      data-testid={`gauss-message-${message.role}`}
      style={{
        ...bubbleWrapperStyle,
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          ...bubbleStyle,
          backgroundColor: isUser
            ? "var(--gauss-user-bubble, #6366f1)"
            : "var(--gauss-assistant-bubble, #f3f4f6)",
          color: isUser ? "#fff" : "var(--gauss-text, #111827)",
          borderRadius: "var(--gauss-radius, 12px)",
        }}
      >
        {useMarkdown ? (
          <MarkdownRenderer content={text} />
        ) : (
          text && <p style={textStyle}>{text}</p>
        )}
        {toolCalls.length > 0 && (
          <div data-testid="gauss-tool-calls" style={toolCallStyle}>
            {toolCalls.map((tc) =>
              tc.type === "tool-call" ? (
                <div key={tc.toolCallId} style={toolCallItemStyle}>
                  <span style={toolNameStyle}>⚡ {tc.toolName}</span>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ToolCallViewerProps {
  /** Tool calls from message parts. */
  toolCalls: Array<{
    type: "tool-call";
    toolName: string;
    toolCallId: string;
    args: Record<string, unknown>;
  }>;
  /** Tool results (matched by toolCallId). */
  toolResults?: Array<{
    type: "tool-result";
    toolCallId: string;
    result: unknown;
  }>;
  /** Custom class name. */
  className?: string;
}

/** Visualization for tool invocations and their results. */
export function ToolCallViewer({
  toolCalls,
  toolResults = [],
  className,
}: ToolCallViewerProps): React.JSX.Element {
  return (
    <div className={className} data-testid="gauss-tool-call-viewer">
      {toolCalls.map((tc) => {
        const result = toolResults.find((r) => r.toolCallId === tc.toolCallId);
        return (
          <div key={tc.toolCallId} style={toolViewerItemStyle}>
            <div style={toolViewerHeaderStyle}>
              <span style={toolNameStyle}>⚡ {tc.toolName}</span>
              <span style={toolIdStyle}>{tc.toolCallId}</span>
            </div>
            <pre style={toolArgsStyle}>{JSON.stringify(tc.args, null, 2)}</pre>
            {result && (
              <div data-testid="gauss-tool-result">
                <div style={toolResultLabelStyle}>Result:</div>
                <pre style={toolArgsStyle}>
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface AgentSelectorProps {
  /** Available agents. */
  agents: Array<{ id: string; name: string; description?: string }>;
  /** Currently selected agent ID. */
  selectedAgent?: string;
  /** Callback when agent is selected. */
  onSelect: (agentId: string) => void;
  /** Custom class name. */
  className?: string;
}

/** Agent picker dropdown/list. */
export function AgentSelector({
  agents,
  selectedAgent,
  onSelect,
  className,
}: AgentSelectorProps): React.JSX.Element {
  return (
    <select
      className={className}
      data-testid="gauss-agent-selector"
      value={selectedAgent ?? ""}
      onChange={(e) => onSelect(e.target.value)}
      style={selectorStyle}
    >
      <option value="" disabled>
        Select an agent...
      </option>
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.name}
          {agent.description ? ` — ${agent.description}` : ""}
        </option>
      ))}
    </select>
  );
}

export interface ChatPanelProps {
  /** Messages to display. */
  messages: ChatMessage[];
  /** Callback when user sends a message. */
  onSend: (text: string) => void;
  /** Current chat status. */
  status?: ChatStatus;
  /** Stop streaming callback. */
  onStop?: () => void;
  /** Input placeholder. */
  placeholder?: string;
  /** Custom theme. */
  theme?: GaussTheme;
  /** Custom class name. */
  className?: string;
  /** Custom message renderer. */
  renderMessage?: (message: ChatMessage, index: number) => React.ReactNode;
  /** Header content. */
  header?: React.ReactNode;
  /** Slot rendered before the textarea. */
  inputStartSlot?: React.ReactNode;
  /** Slot rendered after the send button. */
  inputEndSlot?: React.ReactNode;
  /** Render assistant messages as Markdown. Default: false. */
  markdown?: boolean;
}

/** Full chat interface combining MessageList, ChatInput, and StreamingIndicator. */
export function ChatPanel({
  messages,
  onSend,
  status = "idle",
  onStop,
  placeholder,
  theme,
  className,
  renderMessage,
  header,
  inputStartSlot,
  inputEndSlot,
  markdown = false,
}: ChatPanelProps): React.JSX.Element {
  const vars = theme ? themeToVars(theme) : {};
  const isStreaming = status === "streaming";

  return (
    <div
      className={className}
      data-testid="gauss-chat-panel"
      style={{ ...panelStyle, ...vars } as React.CSSProperties}
    >
      {header && <div data-testid="gauss-chat-header" style={headerStyle}>{header}</div>}
      <MessageList
        messages={messages}
        theme={theme}
        renderMessage={renderMessage}
        markdown={markdown}
      />
      <StreamingIndicator isStreaming={isStreaming} />
      <ChatInput
        onSend={onSend}
        status={status}
        onStop={onStop}
        placeholder={placeholder}
        inputStartSlot={inputStartSlot}
        inputEndSlot={inputEndSlot}
      />
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--gauss-font, system-ui, -apple-system, sans-serif)",
  backgroundColor: "var(--gauss-bg, #ffffff)",
  color: "var(--gauss-text, #111827)",
};

const headerStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #e5e7eb",
};

const messageListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const bubbleWrapperStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
};

const bubbleStyle: React.CSSProperties = {
  maxWidth: "80%",
  padding: "10px 14px",
};

const textStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const inputContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "8px",
  padding: "12px 16px",
  borderTop: "1px solid #e5e7eb",
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  resize: "none",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "14px",
  lineHeight: "1.5",
  outline: "none",
  fontFamily: "inherit",
};

const sendButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  border: "none",
  backgroundColor: "var(--gauss-primary, #6366f1)",
  color: "#fff",
  cursor: "pointer",
  fontSize: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const stopButtonStyle: React.CSSProperties = {
  ...sendButtonStyle,
  backgroundColor: "#ef4444",
};

const indicatorStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 16px",
  fontSize: "13px",
  color: "#6b7280",
};

const dotsStyle: React.CSSProperties = {
  display: "inline-flex",
};

const dotStyle: React.CSSProperties = {
  display: "inline-block",
};

const toolCallStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const toolCallItemStyle: React.CSSProperties = {
  fontSize: "12px",
  opacity: 0.8,
};

const toolNameStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "13px",
};

const toolViewerItemStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "12px",
  marginBottom: "8px",
};

const toolViewerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const toolIdStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  fontFamily: "monospace",
};

const toolArgsStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "4px",
  padding: "8px",
  fontSize: "12px",
  fontFamily: "monospace",
  overflow: "auto",
  margin: 0,
};

const toolResultLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#059669",
  marginTop: "8px",
  marginBottom: "4px",
};

const selectorStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  cursor: "pointer",
};

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { MarkdownRenderer } from "./markdown-renderer.js";
export type { MarkdownRendererProps } from "./markdown-renderer.js";

export { FileUpload } from "./file-upload.js";
export type { FileUploadProps } from "./file-upload.js";

export { ConversationList } from "./conversation-list.js";
export type { ConversationListProps, Conversation as ConversationItem } from "./conversation-list.js";

export { SyntaxHighlighter, createCodeBlockRenderer } from "./syntax-highlighter.js";
export type { SyntaxHighlighterProps } from "./syntax-highlighter.js";

export { VoiceInput } from "./voice-input.js";
export type { VoiceInputProps } from "./voice-input.js";
