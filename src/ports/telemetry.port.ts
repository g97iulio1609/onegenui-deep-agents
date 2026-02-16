// =============================================================================
// Telemetry Port — Contract for OpenTelemetry-compatible observability
// =============================================================================

export interface TelemetrySpan {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: "OK" | "ERROR", message?: string): void;
  end(): void;
}

export interface TelemetryPort {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): TelemetrySpan;
  recordMetric(name: string, value: number, attributes?: Record<string, string>): void;
  flush(): Promise<void>;
}
