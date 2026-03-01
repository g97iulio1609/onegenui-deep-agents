/**
 * Memory SDK wrapper — in-memory conversation/session store backed by Rust core.
 */
import {
  create_memory,
  memory_store,
  memory_recall,
  memory_clear,
  memory_stats,
  destroy_memory,
} from "gauss-napi";

import type {
  Handle,
  Disposable,
  MemoryEntry,
  MemoryEntryType,
  RecallOptions,
} from "./types.js";

/**
 * In-memory conversation store backed by Rust core.
 *
 * @example
 *   const mem = new Memory();
 *   await mem.store({ id: "m1", content: "Hello", entryType: "message", timestamp: new Date().toISOString() });
 *   const entries = await mem.recall();
 *   mem.destroy();
 */
export class Memory implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_memory();
  }

  get handle(): Handle {
    return this._handle;
  }

  /** Store a memory entry. Accepts a full entry or role+content shorthand. */
  async store(entry: MemoryEntry): Promise<void>;
  async store(role: string, content: string, sessionId?: string): Promise<void>;
  async store(
    entryOrRole: MemoryEntry | string,
    content?: string,
    sessionId?: string
  ): Promise<void> {
    this.assertNotDisposed();
    const entry: MemoryEntry =
      typeof entryOrRole === "string"
        ? {
            id: crypto.randomUUID(),
            content: content!,
            entryType: (entryOrRole as MemoryEntryType) || "conversation",
            timestamp: new Date().toISOString(),
            sessionId,
          }
        : entryOrRole;
    // Convert to snake_case for Rust serde
    const rustEntry = {
      id: entry.id,
      content: entry.content,
      entry_type: entry.entryType,
      timestamp: entry.timestamp,
      tier: entry.tier,
      metadata: entry.metadata,
      importance: entry.importance,
      session_id: entry.sessionId,
      embedding: entry.embedding,
    };
    return memory_store(this._handle, JSON.stringify(rustEntry));
  }

  async recall(options?: RecallOptions): Promise<MemoryEntry[]> {
    this.assertNotDisposed();
    const json = options ? JSON.stringify(options) : undefined;
    return memory_recall(this._handle, json) as Promise<MemoryEntry[]>;
  }

  async clear(sessionId?: string): Promise<void> {
    this.assertNotDisposed();
    return memory_clear(this._handle, sessionId);
  }

  async stats(): Promise<Record<string, unknown>> {
    this.assertNotDisposed();
    return memory_stats(this._handle) as Promise<Record<string, unknown>>;
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_memory(this._handle);
      } catch {
        // Already destroyed.
      }
    }
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Memory has been destroyed");
    }
  }
}
