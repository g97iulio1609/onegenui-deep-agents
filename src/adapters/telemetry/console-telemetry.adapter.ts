// =============================================================================
// ConsoleTelemetryAdapter — Logs spans and metrics to console (zero deps)
// =============================================================================

import type { TelemetryPort, TelemetrySpan } from "../../ports/telemetry.port.js";

class ConsoleTelemetrySpan implements TelemetrySpan {
  private readonly name: string;
  private readonly attributes: Record<string, string | number | boolean> = {};
  private readonly startTime = Date.now();

  constructor(name: string, initialAttributes?: Record<string, string | number | boolean>) {
    this.name = name;
    if (initialAttributes) {
      Object.assign(this.attributes, initialAttributes);
    }
    console.log(`[telemetry] span:start ${this.name}`, this.attributes);
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  setStatus(code: "OK" | "ERROR", message?: string): void {
    this.attributes["status.code"] = code;
    if (message) this.attributes["status.message"] = message;
  }

  end(): void {
    const durationMs = Date.now() - this.startTime;
    console.log(`[telemetry] span:end ${this.name} (${durationMs}ms)`, this.attributes);
  }
}

export class ConsoleTelemetryAdapter implements TelemetryPort {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): TelemetrySpan {
    return new ConsoleTelemetrySpan(name, attributes);
  }

  recordMetric(name: string, value: number, attributes?: Record<string, string>): void {
    console.log(`[telemetry] metric ${name}=${value}`, attributes ?? {});
  }

  async flush(): Promise<void> {
    // Console output is synchronous — nothing to flush
  }
}
