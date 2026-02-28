// =============================================================================
// JsonExporter — Exports traces as JSON
// =============================================================================

import type {
  TraceExporter,
  TraceData,
} from "../../../ports/observability-pipeline.port.js";

export type JsonExporterSink = (json: string) => void | Promise<void>;

export class JsonExporter implements TraceExporter {
  readonly id: string;
  readonly name = "json";
  private readonly sink: JsonExporterSink;

  constructor(sink: JsonExporterSink, id = "json-exporter") {
    this.id = id;
    this.sink = sink;
  }

  async export(traces: TraceData[]): Promise<void> {
    const json = JSON.stringify(traces, null, 2);
    await this.sink(json);
  }
}
