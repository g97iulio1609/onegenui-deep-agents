// =============================================================================
// ConsoleExporter — Exports traces to console for development
// =============================================================================

import type {
  TraceExporter,
  TraceData,
} from "../../../ports/observability-pipeline.port.js";

export class ConsoleExporter implements TraceExporter {
  readonly id: string;
  readonly name = "console";

  constructor(id = "console-exporter") {
    this.id = id;
  }

  async export(traces: TraceData[]): Promise<void> {
    for (const trace of traces) {
      console.log(
        `[trace:${trace.id}] ${trace.spans.length} spans, duration=${trace.duration ?? "pending"}ms`,
      );
      for (const span of trace.spans) {
        const indent = span.parentId ? "  " : "";
        const status = span.status
          ? ` [${span.status.code}${span.status.message ? `: ${span.status.message}` : ""}]`
          : "";
        console.log(
          `${indent}[span:${span.kind}] ${span.name} (${span.duration ?? "?"}ms)${status}`,
        );
      }
    }
  }
}
