/**
 * GaussChat — Drop-in complete chat widget.
 *
 * One import, zero wiring — just pass an API endpoint and go.
 *
 * @example
 * ```tsx
 * import { GaussChat } from "@gauss-ai/react";
 *
 * export default function Page() {
 *   return <GaussChat api="/api/chat" />;
 * }
 * ```
 */
import React, { useMemo } from "react";
import { useChat } from "@gauss-ai/chat";
import type { ChatMessage, ChatTransport, UseChatOptions } from "@gauss-ai/chat";
import type { GaussTheme } from "../theme.js";
import { ChatPanel } from "./index.js";
import { useGaussConfig } from "./gauss-provider.js";

export interface GaussChatProps {
  /** API endpoint. Default: "/api/chat". */
  api?: string;
  /** Custom headers for every request. */
  headers?: Record<string, string>;
  /** Extra body data sent with every request. */
  body?: Record<string, unknown>;
  /** Custom transport (overrides api). */
  transport?: ChatTransport;
  /** System prompt. */
  systemPrompt?: string;
  /** Initial messages to pre-populate. */
  initialMessages?: ChatMessage[];
  /** Max automatic tool call rounds. Default: 5. */
  maxToolRoundtrips?: number;
  /** Visual theme. */
  theme?: GaussTheme;
  /** Input placeholder. */
  placeholder?: string;
  /** Header content rendered above the message list. */
  header?: React.ReactNode;
  /** Custom message renderer. */
  renderMessage?: (message: ChatMessage, index: number) => React.ReactNode;
  /** CSS class name for the root container. */
  className?: string;
  /** Inline styles for the root container. */
  style?: React.CSSProperties;
  /** Called on error. */
  onError?: (error: Error) => void;
  /** Called when a response finishes. */
  onFinish?: (message: ChatMessage) => void;
  /** Suggested prompts shown when chat is empty. */
  suggestions?: Array<{ id: string; label: string; prompt?: string }>;
  /** Called when a suggestion is clicked. If not provided, sends the prompt directly. */
  onSuggestion?: (prompt: string) => void;
  /** Slot rendered before the textarea (e.g., file attach button). */
  inputStartSlot?: React.ReactNode;
  /** Slot rendered after the send button (e.g., voice input button). */
  inputEndSlot?: React.ReactNode;
  /** Footer content rendered below the input. */
  footer?: React.ReactNode;
  /** Whether to show a welcome message when no messages exist. */
  welcomeMessage?: string;
}

/** Fully self-contained chat widget — zero wiring required. */
export function GaussChat({
  api,
  headers,
  body,
  transport,
  systemPrompt,
  initialMessages,
  maxToolRoundtrips,
  theme,
  placeholder,
  header,
  renderMessage,
  className,
  style,
  onError,
  onFinish,
  suggestions,
  onSuggestion,
  inputStartSlot: _inputStartSlot,
  inputEndSlot: _inputEndSlot,
  footer,
  welcomeMessage,
}: GaussChatProps): React.JSX.Element {
  const globalConfig = useGaussConfig();

  const hookOpts: UseChatOptions = useMemo(
    () => ({
      api: api ?? globalConfig.api,
      headers: { ...globalConfig.headers, ...headers },
      body: { ...globalConfig.body, ...body },
      credentials: globalConfig.credentials,
      transport,
      systemPrompt,
      initialMessages,
      maxToolRoundtrips,
      onError,
      onFinish,
    }),
    [api, headers, body, transport, systemPrompt, initialMessages, maxToolRoundtrips, onError, onFinish, globalConfig],
  );

  const resolvedTheme = theme ?? globalConfig.theme;

  const { messages, sendMessage, status, stop } = useChat(hookOpts);

  const isEmpty = messages.length === 0;

  const suggestionsBar =
    suggestions && suggestions.length > 0 && isEmpty ? (
      <div data-testid="gauss-suggestions" style={suggestionsStyle}>
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              const prompt = s.prompt ?? s.label;
              if (onSuggestion) {
                onSuggestion(prompt);
              } else {
                sendMessage(prompt);
              }
            }}
            style={suggestionChipStyle}
            type="button"
            data-testid={`gauss-suggestion-${s.id}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    ) : null;

  const welcomeContent =
    welcomeMessage && isEmpty ? (
      <div data-testid="gauss-welcome" style={welcomeStyle}>
        {welcomeMessage}
      </div>
    ) : null;

  return (
    <div
      data-testid="gauss-chat"
      className={className}
      style={{ height: "100%", display: "flex", flexDirection: "column", ...style }}
    >
      <ChatPanel
        messages={messages}
        onSend={(text) => sendMessage(text)}
        status={status}
        onStop={stop}
        theme={resolvedTheme}
        placeholder={placeholder}
        header={
          <>
            {header}
            {welcomeContent}
            {suggestionsBar}
          </>
        }
        renderMessage={renderMessage}
      />
      {footer && <div data-testid="gauss-footer" style={footerStyle}>{footer}</div>}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const suggestionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  padding: "12px 16px",
};

const suggestionChipStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "20px",
  border: "1px solid #e5e7eb",
  backgroundColor: "transparent",
  color: "inherit",
  fontSize: "13px",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
};

const welcomeStyle: React.CSSProperties = {
  padding: "24px 16px 8px",
  textAlign: "center",
  color: "#6b7280",
  fontSize: "14px",
};

const footerStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderTop: "1px solid #e5e7eb",
  fontSize: "12px",
  color: "#9ca3af",
  textAlign: "center",
};
