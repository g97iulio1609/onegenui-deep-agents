// =============================================================================
// Observability Pipeline Tests — 22+ tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObservabilityPipelineAdapter } from "../pipeline.adapter.js";
import { SpanImpl, resetSpanCounter } from "../span.js";
import { resetTraceCounter } from "../trace.js";
import { ConsoleExporter } from "../exporters/console-exporter.js";
import { JsonExporter } from "../exporters/json-exporter.js";
import type { TraceExporter } from "../../../ports/observability-pipeline.port.js";

beforeEach(() => {
  resetSpanCounter();
  resetTraceCounter();
});

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

describe("ObservabilityPipeline — Trace", () => {
  it("createTrace returns trace with id", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("test-trace");
    expect(trace.id).toBeDefined();
    expect(typeof trace.id).toBe("string");
  });

  it("Trace has rootSpan", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("root-test");
    expect(trace.rootSpan).toBeDefined();
    expect(trace.rootSpan.name).toBe("root-test");
    expect(trace.rootSpan.kind).toBe("agent");
  });

  it("startSpan creates span with correct kind", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("multi-span");
    const span = trace.startSpan("tool-call", "tool");
    expect(span.kind).toBe("tool");
    expect(span.name).toBe("tool-call");
  });

  it("Trace end ends all open spans", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("end-test");
    const child = trace.startSpan("child", "llm");
    expect(child.endTime).toBeUndefined();
    trace.end();
    expect(child.endTime).toBeDefined();
    expect(trace.rootSpan.endTime).toBeDefined();
  });

  it("Trace toJSON returns complete data", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("json-test", { env: "test" });
    trace.startSpan("llm-call", "llm");
    trace.end();
    const data = trace.toJSON();
    expect(data.id).toBe(trace.id);
    expect(data.spans.length).toBeGreaterThanOrEqual(2); // root + child
    expect(data.metadata).toEqual({ env: "test" });
    expect(data.duration).toBeDefined();
    expect(typeof data.startTime).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Span
// ---------------------------------------------------------------------------

describe("ObservabilityPipeline — Span", () => {
  it("Span setAttribute stores value", () => {
    const span = new SpanImpl("t1", "test", "tool");
    span.setAttribute("key", "value");
    span.setAttribute("count", 42);
    span.setAttribute("flag", true);
    expect(span.attributes).toEqual({ key: "value", count: 42, flag: true });
  });

  it("Span setStatus sets ok status", () => {
    const span = new SpanImpl("t1", "ok-span", "agent");
    span.setStatus("ok");
    expect(span.status).toEqual({ code: "ok", message: undefined });
  });

  it("Span setStatus sets error status", () => {
    const span = new SpanImpl("t1", "err-span", "agent");
    span.setStatus("error", "something failed");
    expect(span.status).toEqual({
      code: "error",
      message: "something failed",
    });
  });

  it("Span addEvent records event with timestamp", () => {
    const span = new SpanImpl("t1", "event-span", "custom");
    span.addEvent("request-start", { url: "/api" });
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe("request-start");
    expect(typeof span.events[0].timestamp).toBe("number");
    expect(span.events[0].attributes).toEqual({ url: "/api" });
  });

  it("Span log records log entry", () => {
    const span = new SpanImpl("t1", "log-span", "llm");
    span.log("info", "Processing started", { step: 1 });
    expect(span.logs).toHaveLength(1);
    expect(span.logs[0].level).toBe("info");
    expect(span.logs[0].message).toBe("Processing started");
    expect(span.logs[0].data).toEqual({ step: 1 });
  });

  it("Span startChild creates child span", () => {
    const parent = new SpanImpl("t1", "parent", "agent");
    const child = parent.startChild("child", "tool");
    expect(child.parentId).toBe(parent.id);
    expect(child.traceId).toBe("t1");
    expect(parent.children).toHaveLength(1);
  });

  it("Span end sets endTime and duration", () => {
    const span = new SpanImpl("t1", "end-test", "custom");
    expect(span.endTime).toBeUndefined();
    expect(span.duration).toBeUndefined();
    span.end();
    expect(span.endTime).toBeDefined();
    expect(typeof span.duration).toBe("number");
    expect(span.duration).toBeGreaterThanOrEqual(0);
  });

  it("Nested spans maintain parent-child relationships", () => {
    const root = new SpanImpl("t1", "root", "agent");
    const child1 = root.startChild("child1", "tool") as SpanImpl;
    const child2 = root.startChild("child2", "llm") as SpanImpl;
    const grandchild = child1.startChild("grandchild", "retrieval") as SpanImpl;

    expect(root.children).toHaveLength(2);
    expect(child1.children).toHaveLength(1);
    expect(child2.children).toHaveLength(0);
    expect(grandchild.parentId).toBe(child1.id);
    expect(child1.parentId).toBe(root.id);

    root.end();
    expect(grandchild.endTime).toBeDefined();
    expect(child1.endTime).toBeDefined();
    expect(child2.endTime).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe("ObservabilityPipeline — Metrics", () => {
  it("Metrics totalTraces counts correctly", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    pipeline.createTrace("trace1");
    pipeline.createTrace("trace2");
    pipeline.createTrace("trace3");
    const metrics = pipeline.getMetrics();
    expect(metrics.totalTraces).toBe(3);
  });

  it("Metrics spansByKind aggregates correctly", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("kind-test");
    trace.startSpan("tool1", "tool");
    trace.startSpan("llm1", "llm");
    trace.startSpan("llm2", "llm");
    trace.end();
    const metrics = pipeline.getMetrics();
    // root is 'agent'
    expect(metrics.spansByKind.agent).toBe(1);
    expect(metrics.spansByKind.tool).toBe(1);
    expect(metrics.spansByKind.llm).toBe(2);
  });

  it("Metrics errorRate calculates correctly", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("err-test");
    const s1 = trace.startSpan("ok-span", "tool");
    s1.setStatus("ok");
    const s2 = trace.startSpan("err-span", "llm");
    s2.setStatus("error", "timeout");
    trace.end();
    const metrics = pipeline.getMetrics();
    // 3 total spans (root + 2), 1 error → ~0.333
    expect(metrics.errorRate).toBeCloseTo(1 / 3, 2);
  });

  it("Metrics averageDurationMs is accurate", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const trace = pipeline.createTrace("duration-test");
    trace.end();
    const metrics = pipeline.getMetrics();
    expect(typeof metrics.averageDurationMs).toBe("number");
    expect(metrics.averageDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Exporters
// ---------------------------------------------------------------------------

describe("ObservabilityPipeline — Exporters", () => {
  it("addExporter registers exporter", () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const exporter: TraceExporter = {
      id: "test-exp",
      name: "test",
      export: vi.fn().mockResolvedValue(undefined),
    };
    pipeline.addExporter(exporter);
    // Verify by flushing — exporter should be called
    const trace = pipeline.createTrace("exp-test");
    trace.end();
    return pipeline.flush().then(() => {
      expect(exporter.export).toHaveBeenCalled();
    });
  });

  it("removeExporter unregisters exporter", async () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const exporter: TraceExporter = {
      id: "removable",
      name: "removable",
      export: vi.fn().mockResolvedValue(undefined),
    };
    pipeline.addExporter(exporter);
    pipeline.removeExporter("removable");
    const trace = pipeline.createTrace("no-export");
    trace.end();
    await pipeline.flush();
    expect(exporter.export).not.toHaveBeenCalled();
  });

  it("flush exports all pending traces", async () => {
    const pipeline = new ObservabilityPipelineAdapter();
    const exported: unknown[] = [];
    const exporter: TraceExporter = {
      id: "capture",
      name: "capture",
      export: vi.fn(async (traces) => {
        exported.push(...traces);
      }),
    };
    pipeline.addExporter(exporter);
    const t1 = pipeline.createTrace("t1");
    t1.end();
    const t2 = pipeline.createTrace("t2");
    t2.end();
    await pipeline.flush();
    expect(exporter.export).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(2);
  });

  it("Console exporter formats output", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exporter = new ConsoleExporter();
    const pipeline = new ObservabilityPipelineAdapter();
    pipeline.addExporter(exporter);
    const trace = pipeline.createTrace("console-test");
    trace.startSpan("inner", "tool");
    trace.end();
    await pipeline.flush();
    expect(consoleSpy).toHaveBeenCalled();
    const allArgs = consoleSpy.mock.calls.map((c) => c[0] as string);
    expect(allArgs.some((a) => a.includes("[trace:"))).toBe(true);
    expect(allArgs.some((a) => a.includes("[span:"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("JSON exporter produces valid JSON", async () => {
    let captured = "";
    const sink = (json: string) => {
      captured = json;
    };
    const exporter = new JsonExporter(sink);
    const pipeline = new ObservabilityPipelineAdapter();
    pipeline.addExporter(exporter);
    const trace = pipeline.createTrace("json-export");
    trace.startSpan("inner", "llm");
    trace.end();
    await pipeline.flush();
    expect(captured.length).toBeGreaterThan(0);
    const parsed = JSON.parse(captured);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBeDefined();
    expect(parsed[0].spans.length).toBeGreaterThanOrEqual(2);
  });
});
