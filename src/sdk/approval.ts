/**
 * HITL — Approval Manager SDK wrapper, backed by Rust core.
 */
import {
  create_approval_manager,
  approval_request,
  approval_approve,
  approval_deny,
  approval_list_pending,
  destroy_approval_manager,
} from "gauss-napi";

import type { Handle, Disposable } from "./types.js";

export class ApprovalManager implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_approval_manager();
  }

  get handle(): Handle {
    return this._handle;
  }

  request(
    toolName: string,
    args: Record<string, unknown>,
    sessionId: string
  ): string {
    this.assertNotDisposed();
    return approval_request(
      this._handle,
      toolName,
      JSON.stringify(args),
      sessionId
    );
  }

  approve(
    requestId: string,
    modifiedArgs?: Record<string, unknown>
  ): void {
    this.assertNotDisposed();
    approval_approve(
      this._handle,
      requestId,
      modifiedArgs ? JSON.stringify(modifiedArgs) : undefined
    );
  }

  deny(requestId: string, reason?: string): void {
    this.assertNotDisposed();
    approval_deny(this._handle, requestId, reason);
  }

  listPending(): unknown {
    this.assertNotDisposed();
    return approval_list_pending(this._handle);
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_approval_manager(this._handle);
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
      throw new Error("ApprovalManager has been destroyed");
    }
  }
}
