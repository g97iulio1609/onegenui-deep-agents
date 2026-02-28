// =============================================================================
// ObservabilityPipelineAdapter — Main adapter implementing the port
// =============================================================================

import type {
  ObservabilityPipelinePort,
  Trace,
  MetricsSummary,
  TraceExporter,
  TraceData,
} from "../../ports/observability-pipeline.port.js";
import { TraceImpl } from "./trace.js";
import { MetricsCollector } from "./metrics-collector.js";

export class ObservabilityPipelineAdapter implements ObservabilityPipelinePort {
  private readonly traces: TraceImpl[] = [];
  private readonly exporters = new Map<string, TraceExporter>();
  private readonly metricsCollector = new MetricsCollector();
  private readonly pendingTraces: TraceData[] = [];
  private readonly maxTraces: number;

  constructor(options?: { maxTraces?: number }) {
    this.maxTraces = options?.maxTraces ?? 10_000;
  }

  createTrace(name: string, metadata?: Record<string, unknown>): Trace {
    const trace = new TraceImpl(name, metadata);
    this.traces.push(trace);
    // Evict oldest completed traces when over limit
    if (this.traces.length > this.maxTraces) {
      const idx = this.traces.findIndex((t) => t.rootSpan.endTime !== undefined);
      if (idx >= 0) this.traces.splice(idx, 1);
    }
    return trace;
  }

  getMetrics(): MetricsSummary {
    const allData = this.traces.map((t) => t.toJSON());
    return this.metricsCollector.computeMetrics(allData);
  }

  addExporter(exporter: TraceExporter): void {
    this.exporters.set(exporter.id, exporter);
  }

  removeExporter(id: string): void {
    this.exporters.delete(id);
  }

  async flush(): Promise<void> {
    const completedIdxs: number[] = [];
    const completed: TraceData[] = [];
    for (let i = 0; i < this.traces.length; i++) {
      if (this.traces[i].rootSpan.endTime !== undefined) {
        completedIdxs.push(i);
        completed.push(this.traces[i].toJSON());
      }
    }
    // Remove flushed traces (reverse order to preserve indices)
    for (let i = completedIdxs.length - 1; i >= 0; i--) {
      this.traces.splice(completedIdxs[i], 1);
    }

    const toExport = [...this.pendingTraces, ...completed];
    this.pendingTraces.length = 0;

    const exporters = Array.from(this.exporters.values());
    await Promise.all(exporters.map((e) => e.export(toExport)));
  }
}
