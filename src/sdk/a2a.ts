/**
 * A2A (Agent-to-Agent) Protocol SDK for TypeScript.
 *
 * Provides a high-level, developer-friendly client for interacting with
 * A2A-compliant agents over HTTP using JSON-RPC 2.0.
 *
 * @example
 * ```ts
 * const client = new A2aClient('http://localhost:8080');
 * const card = await client.discover();
 * const response = await client.ask('What is the weather?');
 * ```
 */

import {
  a2aDiscover,
  a2aSendMessage,
  a2aAsk,
  a2aGetTask,
  a2aCancelTask,
} from 'gauss-napi';

// ── Types ────────────────────────────────────────────────────────────────────

/** A2A message role. */
export type A2aMessageRole = 'user' | 'agent';

/** Content part within a message. */
export interface Part {
  type: 'text' | 'file' | 'data';
  text?: string;
  mimeType?: string;
  data?: unknown;
  file?: { name?: string; mimeType?: string; bytes?: string; uri?: string };
  metadata?: Record<string, unknown>;
}

/** A single A2A message. */
export interface A2aMessage {
  role: A2aMessageRole;
  parts: Part[];
  metadata?: Record<string, unknown>;
}

/** Task state in the A2A lifecycle. */
export type TaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'canceled'
  | 'failed'
  | 'unknown';

/** Task status with optional message. */
export interface TaskStatus {
  state: TaskState;
  message?: A2aMessage;
  timestamp?: string;
}

/** An A2A task. */
export interface Task {
  id: string;
  sessionId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: A2aMessage[];
  metadata?: Record<string, unknown>;
}

/** An artifact produced by an agent. */
export interface Artifact {
  name?: string;
  description?: string;
  parts: Part[];
  index?: number;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

/** Agent capability declaration. */
export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

/** Skill declared in an AgentCard. */
export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

/** Agent Card — served at /.well-known/agent.json */
export interface AgentCard {
  name: string;
  description?: string;
  url: string;
  version?: string;
  documentationUrl?: string;
  capabilities?: AgentCapabilities;
  skills?: AgentSkill[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  provider?: { organization?: string; url?: string };
  authentication?: { schemes?: string[]; credentials?: string };
}

/** Configuration for sending a message. */
export interface MessageSendConfig {
  acceptedOutputModes?: string[];
  pushNotificationConfig?: {
    url: string;
    token?: string;
    authentication?: { schemes?: string[]; credentials?: string };
  };
  historyLength?: number;
  blocking?: boolean;
}

/** Result of sending a message — either a Task or a Message. */
export type SendMessageResult =
  | { type: 'task'; task: Task }
  | { type: 'message'; message: A2aMessage };

// ── Client ───────────────────────────────────────────────────────────────────

/** Options for creating an A2aClient. */
export interface A2aClientOptions {
  /** Base URL of the A2A agent (e.g., 'http://localhost:8080'). */
  baseUrl: string;
  /** Optional Bearer token for authentication. */
  authToken?: string;
}

/**
 * Client for communicating with A2A-compliant agents.
 *
 * @example
 * ```ts
 * const client = new A2aClient({ baseUrl: 'http://localhost:8080' });
 *
 * // Discover agent capabilities
 * const card = await client.discover();
 * console.log(card.name, card.skills);
 *
 * // Quick ask (text in → text out)
 * const answer = await client.ask('Summarize this document.');
 *
 * // Full message exchange
 * const result = await client.sendMessage({
 *   role: 'user',
 *   parts: [{ type: 'text', text: 'Hello!' }],
 * });
 *
 * // Get task status
 * const task = await client.getTask('task-123');
 *
 * // Cancel a task
 * await client.cancelTask('task-123');
 * ```
 */
export class A2aClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;

  constructor(options: A2aClientOptions | string) {
    if (typeof options === 'string') {
      this.baseUrl = options;
    } else {
      this.baseUrl = options.baseUrl;
      this.authToken = options.authToken;
    }
  }

  /**
   * Discover the remote agent's capabilities by fetching its AgentCard.
   * The card is served at `/.well-known/agent.json`.
   */
  async discover(): Promise<AgentCard> {
    const raw = await a2aDiscover(this.baseUrl, this.authToken ?? undefined);
    return raw as AgentCard;
  }

  /**
   * Send a message to the agent and receive either a Task or a Message.
   */
  async sendMessage(
    message: A2aMessage,
    config?: MessageSendConfig,
  ): Promise<SendMessageResult> {
    const raw = await a2aSendMessage(
      this.baseUrl,
      this.authToken ?? undefined,
      JSON.stringify(message),
      config ? JSON.stringify(config) : undefined,
    );
    if (raw._type === 'task') {
      const { _type, ...task } = raw;
      return { type: 'task', task: task as Task };
    }
    const { _type, ...msg } = raw;
    return { type: 'message', message: msg as A2aMessage };
  }

  /**
   * Quick helper: send a text message and get a text response.
   * Sends the text, polls until the task completes, and returns the final text.
   */
  async ask(text: string): Promise<string> {
    return a2aAsk(this.baseUrl, this.authToken ?? undefined, text);
  }

  /**
   * Get a task by its ID.
   * @param taskId - The task identifier.
   * @param historyLength - Optional number of history messages to include.
   */
  async getTask(taskId: string, historyLength?: number): Promise<Task> {
    const raw = await a2aGetTask(
      this.baseUrl,
      this.authToken ?? undefined,
      taskId,
      historyLength ?? undefined,
    );
    return raw as Task;
  }

  /**
   * Cancel a running task.
   * @param taskId - The task identifier to cancel.
   */
  async cancelTask(taskId: string): Promise<Task> {
    const raw = await a2aCancelTask(
      this.baseUrl,
      this.authToken ?? undefined,
      taskId,
    );
    return raw as Task;
  }
}

// ── Helper Builders ──────────────────────────────────────────────────────────

/** Create a text message. */
export function textMessage(
  role: A2aMessageRole,
  text: string,
): A2aMessage {
  return { role, parts: [{ type: 'text', text }] };
}

/** Create a user text message. */
export function userMessage(text: string): A2aMessage {
  return textMessage('user', text);
}

/** Create an agent text message. */
export function agentMessage(text: string): A2aMessage {
  return textMessage('agent', text);
}

/** Extract all text from a message's parts. */
export function extractText(message: A2aMessage): string {
  return message.parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
    .join('');
}

/** Extract text from a task's latest status message. */
export function taskText(task: Task): string | undefined {
  if (task.status.message) {
    return extractText(task.status.message);
  }
  return undefined;
}
