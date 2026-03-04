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
        header={header}
        renderMessage={renderMessage}
      />
    </div>
  );
}
