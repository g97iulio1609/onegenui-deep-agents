/** Core types for @gauss-ai/chat */

/** Roles supported in chat messages. */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/** A single part of a chat message (text, tool call, or tool result). */
export type MessagePart =
  | TextPart
  | ToolCallPart
  | ToolResultPart;

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool-call";
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
}

/** A chat message with an ID, role, and structured parts. */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  createdAt?: Date;
}

/** Simplified message for sending (text-only). */
export interface SendMessageOptions {
  text: string;
  /** Additional data to send alongside the message. */
  data?: Record<string, unknown>;
}

/** Status of the chat connection. */
export type ChatStatus = "idle" | "loading" | "streaming" | "error";

/** A streaming event from the server. */
export type StreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolName: string; toolCallId: string; args: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | { type: "thinking"; text: string }
  | { type: "cost"; totalUsd: number; stepCosts: number[] }
  | { type: "trace"; trace: AgentStreamTrace }
  | { type: "finish"; finishReason: string }
  | { type: "error"; error: string };

/** Options for configuring a chat transport. */
export interface TransportOptions {
  /** API endpoint URL. */
  api: string;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
  /** Request body extras merged into every request. */
  body?: Record<string, unknown>;
  /** AbortController signal for cancellation. */
  signal?: AbortSignal;
  /** Credentials policy. */
  credentials?: RequestCredentials;
}

/** The transport interface that chat hooks use to communicate with the server. */
export interface ChatTransport {
  /** Send messages and receive a stream of events. */
  send(
    messages: ChatMessage[],
    options: TransportOptions & { signal: AbortSignal },
  ): AsyncIterable<StreamEvent>;
}

/** Options shared by useChat and useCompletion hooks. */
export interface SharedHookOptions {
  /** Custom ID for this chat instance (for multi-chat). */
  id?: string;
  /** API endpoint URL. Default: "/api/chat". */
  api?: string;
  /** Additional headers. */
  headers?: Record<string, string>;
  /** Extra body data sent with every request. */
  body?: Record<string, unknown>;
  /** Custom transport. */
  transport?: ChatTransport;
  /** Credentials policy. */
  credentials?: RequestCredentials;
  /** Callback on error. */
  onError?: (error: Error) => void;
  /** Callback on finish. */
  onFinish?: (message: ChatMessage) => void;
}

/** Options for the useChat hook. */
export interface UseChatOptions extends SharedHookOptions {
  /** Initial messages to populate the chat. */
  initialMessages?: ChatMessage[];
  /** System prompt prepended to all requests. */
  systemPrompt?: string;
  /** Maximum number of automatic tool call rounds. Default: 5. */
  maxToolRoundtrips?: number;
}

/** Return value of the useChat hook. */
export interface UseChatReturn {
  /** All messages in the conversation. */
  messages: ChatMessage[];
  /** Send a new user message. */
  sendMessage: (message: SendMessageOptions | string) => Promise<void>;
  /** Current status of the chat. */
  status: ChatStatus;
  /** The latest error, if any. */
  error: Error | null;
  /** Abort the current streaming response. */
  stop: () => void;
  /** Clear all messages and reset state. */
  reset: () => void;
  /** Whether the chat is currently loading/streaming. */
  isLoading: boolean;
}

/** Options for the useCompletion hook. */
export interface UseCompletionOptions extends SharedHookOptions {
  /** API endpoint URL. Default: "/api/completion". */
  api?: string;
}

/** Return value of the useCompletion hook. */
export interface UseCompletionReturn {
  /** The current completion text. */
  completion: string;
  /** Send a prompt for completion. */
  complete: (prompt: string) => Promise<void>;
  /** Current status. */
  status: ChatStatus;
  /** Latest error, if any. */
  error: Error | null;
  /** Abort current completion. */
  stop: () => void;
  /** Whether currently loading/streaming. */
  isLoading: boolean;
}

/** Options for the useAssistant hook. */
export interface UseAssistantOptions extends SharedHookOptions {
  /** API endpoint URL. Default: "/api/assistant". */
  api?: string;
  /** Thread ID to resume. If not provided, creates a new thread. */
  threadId?: string;
  /** Assistant/agent ID to use. */
  assistantId?: string;
}

/** Return value of the useAssistant hook. */
export interface UseAssistantReturn {
  /** All messages in the thread. */
  messages: ChatMessage[];
  /** Send a message to the assistant. */
  sendMessage: (message: SendMessageOptions | string) => Promise<void>;
  /** Current status. */
  status: ChatStatus;
  /** Latest error. */
  error: Error | null;
  /** Current thread ID. */
  threadId: string | undefined;
  /** Cancel the current run. */
  cancel: () => void;
  /** Whether a run is active. */
  isRunning: boolean;
  /** Set thread ID to resume a conversation. */
  setThreadId: (id: string) => void;
}

/** Schema definition for structured output (simplified, no external deps). */
export interface ObjectSchema<T = unknown> {
  /** Parse raw text into the target type. Throws on invalid input. */
  parse: (input: unknown) => T;
  /** Optional: validate without throwing. */
  safeParse?: (input: unknown) => { success: boolean; data?: T; error?: string };
}

/** Options for the useObject hook. */
export interface UseObjectOptions<T> extends SharedHookOptions {
  /** API endpoint. Default: "/api/object". */
  api?: string;
  /** Schema to validate/parse the streamed object. */
  schema: ObjectSchema<T>;
  /** Callback invoked with each valid partial object during streaming. */
  onPartialObject?: (partial: Partial<T>) => void;
}

/** Return value of the useObject hook. */
export interface UseObjectReturn<T> {
  /** The current partial object (updated as tokens stream). */
  object: T | undefined;
  /** Send a prompt to generate the object. */
  submit: (prompt: string) => Promise<void>;
  /** Current status. */
  status: ChatStatus;
  /** Latest error. */
  error: Error | null;
  /** Abort. */
  stop: () => void;
  /** Whether loading. */
  isLoading: boolean;
}

/** Options for the useAgent hook. */
export interface UseAgentOptions extends UseChatOptions {
  /** Agent name/ID to target. */
  agent?: string;
  /** Enable memory integration. */
  enableMemory?: boolean;
  /** Session ID for memory continuity. */
  sessionId?: string;
  /** Callback when agent emits thinking text. */
  onThinking?: (text: string) => void;
  /** Callback when a tool call starts. */
  onToolCall?: (toolName: string, args: unknown) => void;
  /** Callback when a tool call completes. */
  onToolResult?: (toolName: string, result: unknown) => void;
  /** Callback when cost data is updated. */
  onCostUpdate?: (cost: CostInfo) => void;
  /** Callback when trace data is updated. */
  onTraceUpdate?: (trace: AgentStreamTrace) => void;
}

/** Return value of the useAgent hook (extends useChat). */
export interface UseAgentReturn extends UseChatReturn {
  /** Currently selected agent. */
  agent: string | undefined;
  /** Switch to a different agent. */
  setAgent: (agent: string) => void;
  /** Session ID for memory. */
  sessionId: string | undefined;
  /** Current thinking text from the agent. */
  thinking: string | null;
  /** Currently active tool calls. */
  activeTools: ToolCallInfo[];
  /** Cost data from the current/last run. */
  cost: CostInfo | null;
  /** Trace data from the current/last run. */
  trace: AgentStreamTrace | null;
  /** Granular agent status. */
  agentStatus: AgentStatus;
  /** Process an agent-specific SSE event to update hook state. */
  processAgentEvent: (event: { type: string; [key: string]: unknown }) => void;
}

/** Granular agent status. */
export type AgentStatus = "idle" | "thinking" | "calling-tool" | "streaming" | "error";

/** Information about an active tool call. */
export interface ToolCallInfo {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/** Cost information from agent runs. */
export interface CostInfo {
  totalUsd: number;
  stepCosts: number[];
}

/** Trace data from an agent run stream. */
export interface AgentStreamTrace {
  spans: Array<{ name: string; startMs: number; endMs: number }>;
  totalDurationMs: number;
}
