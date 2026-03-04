/**
 * @gauss-ai/chat
 *
 * React hooks for building AI chat interfaces with Gauss.
 *
 * @example
 * ```tsx
 * import { useChat, useCompletion, useAgent } from "@gauss-ai/chat";
 *
 * function Chat() {
 *   const { messages, sendMessage, status } = useChat({ api: "/api/chat" });
 *   // ...
 * }
 * ```
 *
 * @packageDocumentation
 */

// Hooks
export { useChat } from "./hooks/use-chat.js";
export { useCompletion } from "./hooks/use-completion.js";
export { useAgent } from "./hooks/use-agent.js";
export { useAssistant } from "./hooks/use-assistant.js";
export { useObject } from "./hooks/use-object.js";
export { usePersistentChat } from "./hooks/use-persistent-chat.js";

// Context
export { AgentProvider, AgentContext, useAgentConfig } from "./context/agent-provider.js";
export type { AgentProviderConfig, AgentProviderProps } from "./context/agent-provider.js";

// Persistence
export type { ChatStorage } from "./persistence/index.js";
export { LocalStorageAdapter, MemoryStorageAdapter } from "./persistence/index.js";

// Transport
export { GaussTransport } from "./transport/gauss-transport.js";
export { applyMiddleware } from "./transport/middleware.js";
export type { TransportMiddleware } from "./transport/middleware.js";
export { retryMiddleware } from "./transport/retry-middleware.js";
export type { RetryOptions } from "./transport/retry-middleware.js";
export { loggingMiddleware } from "./transport/logging-middleware.js";
export type { LoggingOptions } from "./transport/logging-middleware.js";
export { rateLimitMiddleware, RateLimitError } from "./transport/rate-limit-middleware.js";
export type { RateLimitOptions } from "./transport/rate-limit-middleware.js";
export { hooksMiddleware } from "./transport/hooks-middleware.js";
export type { TransportHooks } from "./transport/hooks-middleware.js";

// Types
export type {
  ChatMessage,
  ChatStatus,
  ChatTransport,
  MessagePart,
  MessageRole,
  SendMessageOptions,
  SharedHookOptions,
  StreamEvent,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  TransportOptions,
  UseAgentOptions,
  UseAgentReturn,
  UseAssistantOptions,
  UseAssistantReturn,
  UseChatOptions,
  UseChatReturn,
  UseCompletionOptions,
  UseCompletionReturn,
  ObjectSchema,
  UseObjectOptions,
  UseObjectReturn,
  AgentStatus,
  ToolCallInfo,
  CostInfo,
  AgentStreamTrace,
} from "./types/index.js";

export type { UsePersistentChatOptions, UsePersistentChatReturn } from "./hooks/use-persistent-chat.js";

// Utilities
export { createAssistantMessage, createUserMessage, generateId, getMessageText } from "./utils/index.js";
