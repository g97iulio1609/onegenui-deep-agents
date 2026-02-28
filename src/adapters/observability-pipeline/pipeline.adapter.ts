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

  createTrace(name: string, metadata?: Record<string, unknown>): Trace {
    const trace = new TraceImpl(name, metadata);
    this.traces.push(trace);
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
    const completed = this.traces
      .filter((t) => t.rootSpan.endTime !== undefined)
      .map((t) => t.toJSON());

    const toExport = [...this.pendingTraces, ...completed];
    this.pendingTraces.length = 0;

    const exporters = Array.from(this.exporters.values());
    await Promise.all(exporters.map((e) => e.export(toExport)));
  }
}
