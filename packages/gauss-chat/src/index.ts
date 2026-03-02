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

// Transport
export { GaussTransport } from "./transport/gauss-transport.js";

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
  UseChatOptions,
  UseChatReturn,
  UseCompletionOptions,
  UseCompletionReturn,
} from "./types/index.js";

// Utilities
export { createAssistantMessage, createUserMessage, generateId, getMessageText } from "./utils/index.js";
