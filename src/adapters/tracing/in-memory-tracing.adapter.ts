// =============================================================================
// InMemoryTracingAdapter — In-memory implementation of TracingPort for testing
// =============================================================================

import type { TracingPort, Span } from "../../ports/tracing.port.js";

class InMemorySpan implements Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly attributes = new Map<string, string | number | boolean>();
  status: "ok" | "error" | "unset" = "unset";
  statusMessage?: string;
  ended = false;

  constructor(name: string, traceId: string, spanId: string) {
    this.name = name;
    this.traceId = traceId;
    this.spanId = spanId;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes.set(key, value);
  }

  setStatus(status: "ok" | "error", message?: string): void {
    this.status = status;
    this.statusMessage = message;
  }

  end(): void {
    this.ended = true;
  }
}

export class InMemoryTracingAdapter implements TracingPort {
  private readonly spans: InMemorySpan[] = [];
  private counter = 0;

  startSpan(name: string, parentSpan?: Span): InMemorySpan {
    const traceId = parentSpan?.traceId ?? `trace-${++this.counter}`;
    const spanId = `span-${++this.counter}`;
    const span = new InMemorySpan(name, traceId, spanId);
    this.spans.push(span);
    return span;
  }

  /** Get all recorded spans */
  getSpans(): readonly InMemorySpan[] {
    return this.spans;
  }

  /** Clear all recorded spans */
  clear(): void {
    this.spans.length = 0;
  }
}
