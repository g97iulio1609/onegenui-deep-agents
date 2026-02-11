// =============================================================================
// MemoryPort — Persistent state storage contract
// =============================================================================

import type { Todo } from "../domain/todo.schema.js";
import type { Checkpoint } from "../domain/checkpoint.schema.js";
import type { Message } from "../types.js";

export interface MemoryPort {
  // Todo management
  saveTodos(sessionId: string, todos: Todo[]): Promise<void>;
  loadTodos(sessionId: string): Promise<Todo[]>;

  // Checkpoint management
  saveCheckpoint(sessionId: string, checkpoint: Checkpoint): Promise<void>;
  loadLatestCheckpoint(sessionId: string): Promise<Checkpoint | null>;
  listCheckpoints(sessionId: string): Promise<Checkpoint[]>;
  deleteOldCheckpoints(sessionId: string, keepCount: number): Promise<void>;

  // Conversation management
  saveConversation(sessionId: string, messages: Message[]): Promise<void>;
  loadConversation(sessionId: string): Promise<Message[]>;

  // Generic key-value metadata
  saveMetadata(sessionId: string, key: string, value: unknown): Promise<void>;
  loadMetadata<T = unknown>(sessionId: string, key: string): Promise<T | null>;
  deleteMetadata(sessionId: string, key: string): Promise<void>;
}
