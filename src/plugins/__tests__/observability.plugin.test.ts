import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { ObservabilityPlugin } from "../observability.plugin.js";
import { InMemoryTracingAdapter } from "../../adapters/tracing/in-memory-tracing.adapter.js";
import { InMemoryMetricsAdapter } from "../../adapters/metrics/in-memory-metrics.adapter.js";
import { ConsoleLoggingAdapter } from "../../adapters/logging/console-logging.adapter.js";
import type { PluginContext } from "../../ports/plugin.port.js";
import { InMemoryAdapter } from "../../adapters/memory/in-memory.adapter.js";
import { VirtualFilesystem } from "../../adapters/filesystem/virtual-fs.adapter.js";

function createMockContext(sessionId = "test-session"): PluginContext {
  return {
    sessionId,
    config: { instructions: "test", maxSteps: 10 },
    filesystem: new VirtualFilesystem(),
    memory: new InMemoryAdapter(),
    toolNames: ["tool1"],
  };
}

describe("ObservabilityPlugin", () => {
  let tracer: InMemoryTracingAdapter;
  let metrics: InMemoryMetricsAdapter;
  let logger: ConsoleLoggingAdapter;
  let plugin: ObservabilityPlugin;
  let consoleSpy: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    tracer = new InMemoryTracingAdapter();
    metrics = new InMemoryMetricsAdapter();
    logger = new ConsoleLoggingAdapter();
    plugin = new ObservabilityPlugin({ tracer, metrics, logger });
    consoleSpy = [
      vi.spyOn(console, "debug").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    consoleSpy.forEach((s) => s.mockRestore());
  });

  it("should have correct name", () => {
    expect(plugin.name).toBe("observability");
  });

  describe("beforeRun", () => {
    it("should start a root span and log", async () => {
      const ctx = createMockContext();
      await plugin.hooks.beforeRun!(ctx, { prompt: "hello" });

      expect(tracer.getSpans()).toHaveLength(1);
      expect(tracer.getSpans()[0]!.name).toBe("agent.run");
      expect(tracer.getSpans()[0]!.attributes.get("session.id")).toBe("test-session");

      const infoEntries = logger.getEntries().filter((e) => e.level === "info");
      expect(infoEntries).toHaveLength(1);
      expect(infoEntries[0]!.message).toBe("Agent run started");

      expect(metrics.getCounter("agent.runs.total")).toBe(1);
    });
  });

  describe("afterRun", () => {
    it("should end the root span and record metrics", async () => {
      const ctx = createMockContext();
      await plugin.hooks.beforeRun!(ctx, { prompt: "hello" });
      await plugin.hooks.afterRun!(ctx, {
        result: { text: "done", steps: [], sessionId: "test-session" },
      });

      const span = tracer.getSpans()[0]!;
      expect(span.status).toBe("ok");
      expect(span.ended).toBe(true);

      expect(metrics.getCounter("agent.runs.success")).toBe(1);

      const infoEntries = logger.getEntries().filter((e) => e.level === "info");
      expect(infoEntries).toHaveLength(2);
      expect(infoEntries[1]!.message).toBe("Agent run completed");
    });
  });

  describe("beforeTool / afterTool", () => {
    it("should create a child span for tool calls", async () => {
      const ctx = createMockContext();
      await plugin.hooks.beforeRun!(ctx, { prompt: "hello" });
      await plugin.hooks.beforeTool!(ctx, { toolName: "readFile", args: {} });

      expect(tracer.getSpans()).toHaveLength(2);
      const toolSpan = tracer.getSpans()[1]!;
      expect(toolSpan.name).toBe("tool.readFile");
      expect(toolSpan.traceId).toBe(tracer.getSpans()[0]!.traceId);

      expect(metrics.getCounter("agent.tools.total", { tool: "readFile" })).toBe(1);
    });

    it("should end the tool span on afterTool", async () => {
      const ctx = createMockContext();
      await plugin.hooks.beforeRun!(ctx, { prompt: "hello" });
      await plugin.hooks.beforeTool!(ctx, { toolName: "readFile", args: {} });
      await plugin.hooks.afterTool!(ctx, { toolName: "readFile", args: {}, result: "content" });

      const toolSpan = tracer.getSpans()[1]!;
      expect(toolSpan.status).toBe("ok");
      expect(toolSpan.ended).toBe(true);
    });
  });

  describe("onError", () => {
    it("should set error status on span and log", async () => {
      const ctx = createMockContext();
      await plugin.hooks.beforeRun!(ctx, { prompt: "hello" });
      await plugin.hooks.onError!(ctx, { error: new Error("boom"), phase: "run" });

      const span = tracer.getSpans()[0]!;
      expect(span.status).toBe("error");
      expect(span.statusMessage).toBe("boom");
      expect(span.attributes.get("error.type")).toBe("Error");
      expect(span.ended).toBe(true);

      expect(metrics.getCounter("agent.runs.errors")).toBe(1);

      const errorEntries = logger.getEntries().filter((e) => e.level === "error");
      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0]!.message).toBe("Agent error");
    });

    it("should handle non-Error objects", async () => {
      const ctx = createMockContext();
      await plugin.hooks.beforeRun!(ctx, { prompt: "hello" });
      await plugin.hooks.onError!(ctx, { error: "string error", phase: "run" });

      const span = tracer.getSpans()[0]!;
      expect(span.statusMessage).toBe("string error");
      expect(metrics.getCounter("agent.runs.errors")).toBe(1);
    });
  });

  describe("partial config", () => {
    it("should work with only tracer", async () => {
      const p = new ObservabilityPlugin({ tracer });
      const ctx = createMockContext();
      await p.hooks.beforeRun!(ctx, { prompt: "hello" });
      expect(tracer.getSpans()).toHaveLength(1);
    });

    it("should work with only metrics", async () => {
      const p = new ObservabilityPlugin({ metrics });
      const ctx = createMockContext();
      await p.hooks.beforeRun!(ctx, { prompt: "hello" });
      expect(metrics.getCounter("agent.runs.total")).toBe(1);
    });

    it("should work with only logger", async () => {
      const p = new ObservabilityPlugin({ logger });
      const ctx = createMockContext();
      await p.hooks.beforeRun!(ctx, { prompt: "hello" });
      const infoEntries = logger.getEntries().filter((e) => e.level === "info");
      expect(infoEntries).toHaveLength(1);
    });
  });

  describe("no config", () => {
    it("should work with no config at all", async () => {
      const p = new ObservabilityPlugin();
      const ctx = createMockContext();
      // Should not throw
      await p.hooks.beforeRun!(ctx, { prompt: "hello" });
      await p.hooks.afterRun!(ctx, {
        result: { text: "done", steps: [], sessionId: "test-session" },
      });
      await p.hooks.beforeTool!(ctx, { toolName: "test", args: {} });
      await p.hooks.afterTool!(ctx, { toolName: "test", args: {}, result: "ok" });
      await p.hooks.onError!(ctx, { error: new Error("err"), phase: "run" });
    });
  });
});
