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
  RecallOptions,
} from "./types.js";

/**
 * In-memory conversation store backed by Rust core.
 *
 * @example
 *   const mem = new Memory();
 *   await mem.store({ role: "user", content: "Hello", sessionId: "s1" });
 *   const entries = await mem.recall({ sessionId: "s1" });
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

  /** Store a memory entry. Accepts an object or role+content shorthand. */
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
        ? { role: entryOrRole, content: content!, sessionId }
        : entryOrRole;
    return memory_store(this._handle, JSON.stringify(entry));
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
