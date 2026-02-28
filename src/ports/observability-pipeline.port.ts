// =============================================================================
// Observability Pipeline Port — Contract for unified observability
// =============================================================================

export type SpanKind = 'agent' | 'tool' | 'llm' | 'retrieval' | 'custom';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ObservabilityPipelinePort {
  createTrace(name: string, metadata?: Record<string, unknown>): Trace;
  getMetrics(): MetricsSummary;
  addExporter(exporter: TraceExporter): void;
  removeExporter(id: string): void;
  flush(): Promise<void>;
}

export interface Trace {
  id: string;
  rootSpan: Span;
  startSpan(name: string, kind: SpanKind): Span;
  end(): void;
  toJSON(): TraceData;
}

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  kind: SpanKind;

  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
  startChild(name: string, kind: SpanKind): Span;
  end(): void;

  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly attributes: Record<string, string | number | boolean>;
  readonly events: SpanEvent[];
  readonly logs: LogEntry[];
  readonly children: Span[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface TraceData {
  id: string;
  spans: SpanData[];
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata: Record<string, unknown>;
}

export interface SpanData {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: { code: 'ok' | 'error'; message?: string };
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  logs: LogEntry[];
  children: string[];
}

export interface MetricsSummary {
  totalTraces: number;
  totalSpans: number;
  averageDurationMs: number;
  spansByKind: Record<SpanKind, number>;
  errorRate: number;
  tokenCount: number;
  estimatedCost: number;
}

export interface TraceExporter {
  id: string;
  name: string;
  export(traces: TraceData[]): Promise<void>;
}
