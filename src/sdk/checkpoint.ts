/**
 * HITL — Checkpoint Store SDK wrapper, backed by Rust core.
 */
import {
  create_checkpoint_store,
  checkpoint_save,
  checkpoint_load,
  checkpoint_load_latest,
  destroy_checkpoint_store,
} from "gauss-napi";

import type { Handle, Disposable } from "./types.js";

export class CheckpointStore implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_checkpoint_store();
  }

  get handle(): Handle {
    return this._handle;
  }

  async save(checkpoint: Record<string, unknown>): Promise<void> {
    this.assertNotDisposed();
    return checkpoint_save(this._handle, JSON.stringify(checkpoint));
  }

  async load(checkpointId: string): Promise<unknown> {
    this.assertNotDisposed();
    return checkpoint_load(this._handle, checkpointId);
  }

  async loadLatest(sessionId: string): Promise<unknown> {
    this.assertNotDisposed();
    return checkpoint_load_latest(this._handle, sessionId);
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_checkpoint_store(this._handle);
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
      throw new Error("CheckpointStore has been destroyed");
    }
  }
}
