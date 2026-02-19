// =============================================================================
// SharedContext — Namespaced shared state between agents in a graph
// Supports watchers, versioning (optimistic locking), CRDT merge, and scoping.
// =============================================================================

import type { FilesystemPort } from "../ports/filesystem.port.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  version: number;
  source: string;
  timestamp: number;
}

export type ContextChangeHandler = (change: ContextChange) => void;

export interface Versioned<T> {
  value: T;
  version: number;
}

export class VersionConflictError extends Error {
  constructor(key: string, expected: number, actual: number) {
    super(
      `Version conflict on "${key}": expected ${expected}, actual ${actual}`,
    );
    this.name = "VersionConflictError";
  }
}

// ---------------------------------------------------------------------------
// SharedContext
// ---------------------------------------------------------------------------

export class SharedContext {
  private readonly watchers = new Map<string, Set<ContextChangeHandler>>();
  private readonly versions = new Map<string, number>();
  private readonly parent?: SharedContext;

  constructor(
    private readonly fs: FilesystemPort,
    private readonly namespace: string = "/.shared",
    parent?: SharedContext,
  ) {
    this.parent = parent;
  }

  // ---- helpers ------------------------------------------------------------

  private keyPath(key: string): string {
    return `${this.namespace}/${key}`;
  }

  private getVersion(key: string): number {
    return this.versions.get(key) ?? 0;
  }

  private bumpVersion(key: string): number {
    const next = this.getVersion(key) + 1;
    this.versions.set(key, next);
    return next;
  }

  // ---- notify watchers ----------------------------------------------------

  private notify(change: ContextChange): void {
    const keyHandlers = this.watchers.get(change.key);
    const wildHandlers = this.watchers.get("*");
    if (keyHandlers) {
      for (const h of keyHandlers) h(change);
    }
    if (wildHandlers) {
      for (const h of wildHandlers) h(change);
    }
    // bubble to parent
    if (this.parent) {
      this.parent.notify(change);
    }
  }

  // ---- original API (backward compatible) ---------------------------------

  async set(key: string, value: unknown): Promise<void> {
    const oldValue = await this.get(key);
    await this.fs.write(this.keyPath(key), JSON.stringify(value));
    const version = this.bumpVersion(key);
    this.notify({
      key,
      oldValue,
      newValue: value,
      version,
      source: this.namespace,
      timestamp: Date.now(),
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const path = this.keyPath(key);
    if (!(await this.fs.exists(path))) return null;
    const raw = await this.fs.read(path);
    return JSON.parse(raw) as T;
  }

  async delete(key: string): Promise<void> {
    const path = this.keyPath(key);
    if (await this.fs.exists(path)) {
      const oldValue = await this.get(key);
      await this.fs.delete(path);
      const version = this.bumpVersion(key);
      this.notify({
        key,
        oldValue,
        newValue: undefined,
        version,
        source: this.namespace,
        timestamp: Date.now(),
      });
    }
  }

  async list(): Promise<string[]> {
    if (!(await this.fs.exists(this.namespace))) return [];
    const entries = await this.fs.list(this.namespace);
    return entries
      .filter((e) => !e.isDirectory)
      .map((e) => e.name);
  }

  async getNodeResult(nodeId: string): Promise<string | null> {
    return this.get<string>(`results/${nodeId}`);
  }

  async setNodeResult(nodeId: string, result: string): Promise<void> {
    await this.set(`results/${nodeId}`, result);
  }

  // ---- watchers -----------------------------------------------------------

  /**
   * Subscribe to changes on a specific key, or use "*" for all changes.
   * Returns an unsubscribe function.
   */
  watch(key: string, handler: ContextChangeHandler): () => void {
    let handlers = this.watchers.get(key);
    if (!handlers) {
      handlers = new Set();
      this.watchers.set(key, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) this.watchers.delete(key);
    };
  }

  // ---- versioning (optimistic locking) ------------------------------------

  async getVersioned<T>(key: string): Promise<Versioned<T> | null> {
    const value = await this.get<T>(key);
    if (value === null) return null;
    return { value, version: this.getVersion(key) };
  }

  async setVersioned(
    key: string,
    value: unknown,
    expectedVersion: number,
  ): Promise<void> {
    // Synchronous check-and-bump to avoid TOCTOU race
    const actual = this.getVersion(key);
    if (actual !== expectedVersion) {
      throw new VersionConflictError(key, expectedVersion, actual);
    }
    // Bump version synchronously before async write to prevent concurrent setVersioned
    // from passing the same version check
    this.bumpVersion(key);
    const oldValue = await this.get(key);
    await this.fs.write(this.keyPath(key), JSON.stringify(value));
    this.notify({
      key,
      oldValue,
      newValue: value,
      version: this.getVersion(key),
      source: this.namespace,
      timestamp: Date.now(),
    });
  }

  // ---- CRDT merge ---------------------------------------------------------

  /**
   * Read-then-write with a merge function using optimistic locking.
   * Default mergeFn is Last-Writer-Wins (returns newValue).
   * Retries on version conflict (CAS pattern).
   */
  async merge<T>(
    key: string,
    value: T,
    mergeFn: (oldValue: T | null, newValue: T) => T = (_old, nw) => nw,
  ): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const currentVersion = this.getVersion(key);
      const current = await this.get<T>(key);
      const merged = mergeFn(current, value);
      try {
        await this.setVersioned(key, merged, currentVersion);
        return;
      } catch (err) {
        if (err instanceof VersionConflictError && attempt < maxRetries) {
          continue; // retry
        }
        throw err;
      }
    }
  }

  // ---- scoping ------------------------------------------------------------

  createScoped(scope: string): SharedContext {
    return new SharedContext(this.fs, `${this.namespace}/${scope}`, this);
  }
}
