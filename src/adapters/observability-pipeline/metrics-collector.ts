// =============================================================================
// MetricsCollector — Collects and aggregates metrics from traces
// =============================================================================

import type {
  MetricsSummary,
  SpanKind,
  TraceData,
} from "../../ports/observability-pipeline.port.js";

const ALL_SPAN_KINDS: SpanKind[] = [
  "agent",
  "tool",
  "llm",
  "retrieval",
  "custom",
];

export class MetricsCollector {
  computeMetrics(traces: TraceData[]): MetricsSummary {
    const spansByKind: Record<SpanKind, number> = {
      agent: 0,
      tool: 0,
      llm: 0,
      retrieval: 0,
      custom: 0,
    };

    let totalSpans = 0;
    let totalDuration = 0;
    let completedSpans = 0;
    let errorSpans = 0;
    let tokenCount = 0;
    let estimatedCost = 0;

    for (const trace of traces) {
      for (const span of trace.spans) {
        totalSpans++;
        if (ALL_SPAN_KINDS.includes(span.kind)) {
          spansByKind[span.kind]++;
        }

        if (span.duration !== undefined) {
          totalDuration += span.duration;
          completedSpans++;
        }

        if (span.status?.code === "error") {
          errorSpans++;
        }

        // Aggregate token counts from attributes
        const tokens = span.attributes["tokens"];
        if (typeof tokens === "number") {
          tokenCount += tokens;
        }

        const cost = span.attributes["cost"];
        if (typeof cost === "number") {
          estimatedCost += cost;
        }
      }
    }

    return {
      totalTraces: traces.length,
      totalSpans,
      averageDurationMs:
        completedSpans > 0 ? totalDuration / completedSpans : 0,
      spansByKind,
      errorRate: totalSpans > 0 ? errorSpans / totalSpans : 0,
      tokenCount,
      estimatedCost,
    };
  }
}
