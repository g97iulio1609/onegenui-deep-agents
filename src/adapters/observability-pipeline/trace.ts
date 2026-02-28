// =============================================================================
// TraceImpl — Trace implementation aggregating spans
// =============================================================================

import type {
  Trace,
  SpanKind,
  TraceData,
  Span,
} from "../../ports/observability-pipeline.port.js";
import { SpanImpl } from "./span.js";

let traceCounter = 0;

export function generateTraceId(): string {
  return `trace-${++traceCounter}-${Date.now().toString(36)}`;
}

export function resetTraceCounter(): void {
  traceCounter = 0;
}

export class TraceImpl implements Trace {
  readonly id: string;
  readonly rootSpan: SpanImpl;
  private readonly metadata: Record<string, unknown>;

  constructor(name: string, metadata: Record<string, unknown> = {}) {
    this.id = generateTraceId();
    this.metadata = { ...metadata };
    this.rootSpan = new SpanImpl(this.id, name, "agent");
  }

  startSpan(name: string, kind: SpanKind): Span {
    return this.rootSpan.startChild(name, kind);
  }

  end(): void {
    this.rootSpan.end();
  }

  toJSON(): TraceData {
    const spans = this.rootSpan.collectAll();
    const endTime = this.rootSpan.endTime;
    return {
      id: this.id,
      spans,
      startTime: this.rootSpan.startTime,
      endTime,
      duration: endTime !== undefined ? endTime - this.rootSpan.startTime : undefined,
      metadata: { ...this.metadata },
    };
  }
}
