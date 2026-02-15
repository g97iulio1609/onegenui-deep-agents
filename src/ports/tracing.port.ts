// =============================================================================
// Tracing Port — Contract for distributed tracing
// =============================================================================

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: "ok" | "error", message?: string): void;
  end(): void;
}

export interface TracingPort {
  startSpan(name: string, parentSpan?: Span): Span;
}
