/**
 * Telemetry SDK wrapper — spans and metrics backed by Rust core.
 */
import {
  create_telemetry,
  telemetry_record_span,
  telemetry_export_spans,
  telemetry_export_metrics,
  telemetry_clear,
  destroy_telemetry,
} from "gauss-napi";

import type { Handle, Disposable } from "./types.js";

export class Telemetry implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_telemetry();
  }

  get handle(): Handle {
    return this._handle;
  }

  /** Record a span. Pass a SpanRecord object or use the convenience overload. */
  recordSpan(span: Record<string, unknown>): void;
  recordSpan(name: string, durationMs: number, attributes?: Record<string, unknown>): void;
  recordSpan(
    nameOrSpan: string | Record<string, unknown>,
    durationMs?: number,
    attributes?: Record<string, unknown>,
  ): void {
    this.assertNotDisposed();
    const span = typeof nameOrSpan === "string"
      ? {
          name: nameOrSpan,
          span_type: "custom",
          start_ms: Date.now() - (durationMs ?? 0),
          duration_ms: durationMs ?? 0,
          attributes: attributes ?? {},
          status: "ok",
          children: [],
        }
      : nameOrSpan;
    telemetry_record_span(this._handle, JSON.stringify(span));
  }

  exportSpans(): unknown {
    this.assertNotDisposed();
    return telemetry_export_spans(this._handle);
  }

  exportMetrics(): unknown {
    this.assertNotDisposed();
    return telemetry_export_metrics(this._handle);
  }

  clear(): void {
    this.assertNotDisposed();
    telemetry_clear(this._handle);
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_telemetry(this._handle);
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
      throw new Error("Telemetry has been destroyed");
    }
  }
}
