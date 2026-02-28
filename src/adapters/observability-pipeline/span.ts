// =============================================================================
// SpanImpl — Span implementation with child spans, events, and structured logs
// =============================================================================

import type {
  Span,
  SpanKind,
  SpanEvent,
  LogEntry,
  LogLevel,
  SpanData,
} from "../../ports/observability-pipeline.port.js";

let spanCounter = 0;

export function generateSpanId(): string {
  return `span-${++spanCounter}-${Date.now().toString(36)}`;
}

export function resetSpanCounter(): void {
  spanCounter = 0;
}

export class SpanImpl implements Span {
  readonly id: string;
  readonly traceId: string;
  readonly parentId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;

  private _endTime?: number;
  private _status?: { code: "ok" | "error"; message?: string };
  private readonly _attributes: Record<string, string | number | boolean> = {};
  private readonly _events: SpanEvent[] = [];
  private readonly _logs: LogEntry[] = [];
  private readonly _children: SpanImpl[] = [];

  constructor(
    traceId: string,
    name: string,
    kind: SpanKind,
    parentId?: string,
  ) {
    this.id = generateSpanId();
    this.traceId = traceId;
    this.name = name;
    this.kind = kind;
    this.parentId = parentId;
    this.startTime = Date.now();
  }

  get endTime(): number | undefined {
    return this._endTime;
  }

  get duration(): number | undefined {
    return this._endTime !== undefined
      ? this._endTime - this.startTime
      : undefined;
  }

  get attributes(): Record<string, string | number | boolean> {
    return { ...this._attributes };
  }

  get events(): SpanEvent[] {
    return [...this._events];
  }

  get logs(): LogEntry[] {
    return [...this._logs];
  }

  get children(): Span[] {
    return [...this._children];
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this._attributes[key] = value;
  }

  setStatus(status: "ok" | "error", message?: string): void {
    this._status = { code: status, message };
  }

  addEvent(name: string, attributes?: Record<string, unknown>): void {
    this._events.push({ name, timestamp: Date.now(), attributes });
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this._logs.push({ level, message, timestamp: Date.now(), data });
  }

  startChild(name: string, kind: SpanKind): Span {
    const child = new SpanImpl(this.traceId, name, kind, this.id);
    this._children.push(child);
    return child;
  }

  end(): void {
    if (this._endTime !== undefined) return;
    // End open children first
    for (const child of this._children) {
      if (child.endTime === undefined) child.end();
    }
    this._endTime = Date.now();
  }

  /** Serialise to SpanData including all descendants. */
  toData(): SpanData {
    return {
      id: this.id,
      traceId: this.traceId,
      parentId: this.parentId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this._endTime,
      duration: this.duration,
      status: this._status,
      attributes: { ...this._attributes },
      events: [...this._events],
      logs: [...this._logs],
      children: this._children.map((c) => c.id),
    };
  }

  /** Collect this span and all descendants into a flat list. */
  collectAll(): SpanData[] {
    const result: SpanData[] = [this.toData()];
    for (const child of this._children) {
      result.push(...child.collectAll());
    }
    return result;
  }

  get status(): { code: "ok" | "error"; message?: string } | undefined {
    return this._status;
  }
}
