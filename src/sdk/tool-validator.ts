/**
 * Tool Validator SDK wrapper, backed by Rust core.
 */
import {
  create_tool_validator,
  tool_validator_validate,
  destroy_tool_validator,
} from "gauss-napi";

import type { Handle, Disposable, CoercionStrategy } from "./types.js";

export class ToolValidator implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor(strategies?: CoercionStrategy[]) {
    this._handle = create_tool_validator(strategies);
  }

  get handle(): Handle {
    return this._handle;
  }

  validate(
    input: Record<string, unknown>,
    schema: Record<string, unknown>
  ): unknown {
    this.assertNotDisposed();
    return JSON.parse(
      tool_validator_validate(
        this._handle,
        JSON.stringify(input),
        JSON.stringify(schema)
      )
    );
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_tool_validator(this._handle);
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
      throw new Error("ToolValidator has been destroyed");
    }
  }
}
