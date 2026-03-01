/**
 * McpServer SDK wrapper — Model Context Protocol server backed by Rust core.
 */
import {
  create_mcp_server,
  mcp_server_add_tool,
  mcp_server_handle,
  destroy_mcp_server,
} from "gauss-napi";

import type { Handle, Disposable, ToolDef } from "./types.js";

export class McpServer implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor(name: string, version: string) {
    this._handle = create_mcp_server(name, version);
  }

  get handle(): Handle {
    return this._handle;
  }

  addTool(tool: ToolDef): this {
    this.assertNotDisposed();
    mcp_server_add_tool(this._handle, JSON.stringify(tool));
    return this;
  }

  async handleMessage(message: unknown): Promise<unknown> {
    this.assertNotDisposed();
    return mcp_server_handle(this._handle, JSON.stringify(message));
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_mcp_server(this._handle);
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
      throw new Error("McpServer has been destroyed");
    }
  }
}
