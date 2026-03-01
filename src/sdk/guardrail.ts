/**
 * GuardrailChain SDK wrapper — content safety and validation backed by Rust core.
 */
import {
  create_guardrail_chain,
  guardrail_chain_add_content_moderation,
  guardrail_chain_add_pii_detection,
  guardrail_chain_add_token_limit,
  guardrail_chain_add_regex_filter,
  guardrail_chain_add_schema,
  guardrail_chain_list,
  destroy_guardrail_chain,
} from "gauss-napi";

import type { Handle, Disposable, PiiAction } from "./types.js";

export class GuardrailChain implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_guardrail_chain();
  }

  get handle(): Handle {
    return this._handle;
  }

  addContentModeration(
    blockPatterns: string[],
    warnPatterns: string[] = []
  ): this {
    this.assertNotDisposed();
    guardrail_chain_add_content_moderation(
      this._handle,
      blockPatterns,
      warnPatterns
    );
    return this;
  }

  addPiiDetection(action: PiiAction): this {
    this.assertNotDisposed();
    guardrail_chain_add_pii_detection(this._handle, action);
    return this;
  }

  addTokenLimit(maxInput?: number, maxOutput?: number): this {
    this.assertNotDisposed();
    guardrail_chain_add_token_limit(this._handle, maxInput, maxOutput);
    return this;
  }

  addRegexFilter(blockRules: string[], warnRules: string[] = []): this {
    this.assertNotDisposed();
    guardrail_chain_add_regex_filter(this._handle, blockRules, warnRules);
    return this;
  }

  addSchema(schema: Record<string, unknown>): this {
    this.assertNotDisposed();
    guardrail_chain_add_schema(this._handle, JSON.stringify(schema));
    return this;
  }

  list(): string[] {
    this.assertNotDisposed();
    return guardrail_chain_list(this._handle);
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_guardrail_chain(this._handle);
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
      throw new Error("GuardrailChain has been destroyed");
    }
  }
}
