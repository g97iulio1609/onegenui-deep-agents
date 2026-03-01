/**
 * Plugin SDK wrapper — event-driven plugin system backed by Rust core.
 */
import {
  create_plugin_registry,
  plugin_registry_add_telemetry,
  plugin_registry_add_memory,
  plugin_registry_list,
  plugin_registry_emit,
  destroy_plugin_registry,
} from "gauss-napi";

import type { Handle, Disposable } from "./types.js";

export class PluginRegistry implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_plugin_registry();
  }

  get handle(): Handle {
    return this._handle;
  }

  addTelemetry(): this {
    this.assertNotDisposed();
    plugin_registry_add_telemetry(this._handle);
    return this;
  }

  addMemory(): this {
    this.assertNotDisposed();
    plugin_registry_add_memory(this._handle);
    return this;
  }

  list(): string[] {
    this.assertNotDisposed();
    return plugin_registry_list(this._handle);
  }

  emit(event: Record<string, unknown>): void {
    this.assertNotDisposed();
    plugin_registry_emit(this._handle, JSON.stringify(event));
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_plugin_registry(this._handle);
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
      throw new Error("PluginRegistry has been destroyed");
    }
  }
}
