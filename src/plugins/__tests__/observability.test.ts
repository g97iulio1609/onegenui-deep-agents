// =============================================================================
// ObservabilityPlugin Tests
// =============================================================================

import { describe, test, expect, beforeEach } from "vitest";
import { ObservabilityPlugin, type ObservabilityConfig, type Span, type AgentMetrics } from "../observability.plugin.js";
import type { PluginContext } from "../../ports/plugin.port.js";

// Mock plugin context
const createMockContext = (sessionId = "test-session"): PluginContext => ({
  sessionId,
  agentName: "test-agent",
  config: { instructions: "test", maxSteps: 10 },
  filesystem: {} as any,
  memory: {} as any,
  learning: undefined,
  toolNames: ["test-tool"],
  runMetadata: {}
});

describe("ObservabilityPlugin", () => {
  let plugin: ObservabilityPlugin;
  let ctx: PluginContext;

  beforeEach(() => {
    plugin = new ObservabilityPlugin();
    ctx = createMockContext();
  });

  describe("Configuration", () => {
    test("uses default configuration when none provided", () => {
      const plugin = new ObservabilityPlugin();
      expect(plugin.name).toBe("observability");
      expect(plugin.version).toBe("1.0.0");
    });

    test("accepts custom configuration", () => {
      const config: ObservabilityConfig = {
        enableTracing: false,
        enableMetrics: false,
        enableCostEstimation: true,
        costPerInputToken: 0.001,
        costPerOutputToken: 0.002
      };
      const plugin = new ObservabilityPlugin(config);
      expect(plugin.name).toBe("observability");
    });
  });

  describe("Span Creation and Nesting", () => {
    test("creates root span on request", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test prompt" });
      
      const traces = plugin.getTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].name).toBe("agent.run");
      expect(traces[0].parentId).toBeUndefined();
      expect(traces[0].attributes.sessionId).toBe("test-session");
      expect(traces[0].attributes.prompt).toBe("test prompt");
    });

    test("creates nested tool spans", async () => {
      // Start root span
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test prompt" });
      
      // Start tool span
      await plugin.hooks.beforeTool?.(ctx, { toolName: "test-tool", args: { param: "value" } });
      
      const traces = plugin.getTraces();
      expect(traces).toHaveLength(1);
      
      const rootSpan = traces[0];
      expect(rootSpan.children).toHaveLength(1);
      
      const toolSpan = rootSpan.children[0];
      expect(toolSpan.name).toBe("tool.test-tool");
      expect(toolSpan.parentId).toBe(rootSpan.id);
      expect(toolSpan.attributes.toolName).toBe("test-tool");
      expect(toolSpan.attributes.args).toEqual({ param: "value" });
    });

    test("ends spans correctly", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test prompt" });
      await plugin.hooks.beforeTool?.(ctx, { toolName: "test-tool", args: {} });
      
      // End tool span
      await plugin.hooks.afterTool?.(ctx, { 
        toolName: "test-tool", 
        args: {}, 
        result: "tool result" 
      });
      
      // End root span
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "final result", steps: [], sessionId: "test-session" } 
      });
      
      const traces = plugin.getTraces();
      const rootSpan = traces[0];
      const toolSpan = rootSpan.children[0];
      
      expect(rootSpan.endTime).toBeDefined();
      expect(toolSpan.endTime).toBeDefined();
      expect(rootSpan.status).toBe("ok");
      expect(toolSpan.status).toBe("ok");
    });
  });

  describe("Metrics Aggregation", () => {
    test("tracks tool calls", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      
      const startTime = Date.now();
      await plugin.hooks.beforeTool?.(ctx, { toolName: "test-tool", args: {} });
      
      // Simulate some delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await plugin.hooks.afterTool?.(ctx, { 
        toolName: "test-tool", 
        args: {}, 
        result: "result" 
      });
      
      const metrics = plugin.getMetrics();
      expect(metrics.toolCalls).toHaveLength(1);
      expect(metrics.toolCalls[0].name).toBe("test-tool");
      expect(metrics.toolCalls[0].latencyMs).toBeGreaterThan(0);
      expect(metrics.toolCalls[0].success).toBe(true);
    });

    test("calculates total latency", async () => {
      const startTime = Date.now();
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      
      // Simulate some delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "result", steps: [], sessionId: "test-session" } 
      });
      
      const metrics = plugin.getMetrics();
      expect(metrics.totalLatencyMs).toBeGreaterThan(0);
    });

    test("returns empty metrics when disabled", () => {
      const plugin = new ObservabilityPlugin({ enableMetrics: false });
      const metrics = plugin.getMetrics();
      
      expect(metrics.totalTokens.input).toBe(0);
      expect(metrics.totalTokens.output).toBe(0);
      expect(metrics.totalLatencyMs).toBe(0);
      expect(metrics.toolCalls).toHaveLength(0);
      expect(metrics.llmCalls).toHaveLength(0);
      expect(metrics.estimatedCostUsd).toBeUndefined();
    });
  });

  describe("Cost Estimation", () => {
    test("calculates cost when enabled", async () => {
      const plugin = new ObservabilityPlugin({
        enableCostEstimation: true,
        costPerInputToken: 0.001,
        costPerOutputToken: 0.002
      });
      
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      
      // Simulate token usage via internal session metrics
      const sessionMetrics = (plugin as any).sessionMetrics.get("test-session");
      sessionMetrics.totalTokens.input = 100;
      sessionMetrics.totalTokens.output = 50;
      
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "result", steps: [], sessionId: "test-session" } 
      });
      
      const finalMetrics = plugin.getMetrics();
      expect(finalMetrics.estimatedCostUsd).toBe(0.2); // 100 * 0.001 + 50 * 0.002
    });

    test("does not calculate cost when disabled", async () => {
      const plugin = new ObservabilityPlugin({ enableCostEstimation: false });
      
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "result", steps: [], sessionId: "test-session" } 
      });
      
      const metrics = plugin.getMetrics();
      expect(metrics.estimatedCostUsd).toBeUndefined();
    });
  });

  describe("Error Recording", () => {
    test("marks spans as error when onError is called", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      await plugin.hooks.beforeTool?.(ctx, { toolName: "test-tool", args: {} });
      
      const error = new Error("Test error");
      await plugin.hooks.onError?.(ctx, { error, phase: "tool" });
      
      const traces = plugin.getTraces();
      // Check that we have at least one root span
      expect(traces.length).toBeGreaterThan(0);
      
      // Find any span with error status (could be root or tool span)
      const allSpans = Array.from(plugin['spans'].values());
      const errorSpan = allSpans.find(s => s.status === 'error');
      
      expect(errorSpan).toBeDefined();
      expect(errorSpan!.status).toBe("error");
      expect(errorSpan!.attributes.error).toEqual({
        message: "Test error",
        phase: "tool"
      });
      expect(errorSpan!.endTime).toBeDefined();
    });

    test("handles string errors", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      
      await plugin.hooks.onError?.(ctx, { error: "String error", phase: "run" });
      
      const traces = plugin.getTraces();
      const rootSpan = traces[0];
      
      expect(rootSpan.status).toBe("error");
      expect(rootSpan.attributes.error).toEqual({
        message: "String error",
        phase: "run"
      });
    });
  });

  describe("OpenTelemetry Export", () => {
    test("exports traces in OpenTelemetry format", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "result", steps: [], sessionId: "test-session" } 
      });
      
      const otelData = plugin.exportOpenTelemetry();
      
      expect(otelData).toHaveProperty("resourceSpans");
      const resourceSpans = (otelData as any).resourceSpans;
      expect(resourceSpans).toHaveLength(1);
      
      const scopeSpans = resourceSpans[0].scopeSpans[0];
      expect(scopeSpans.scope.name).toBe("deepagent-observability");
      expect(scopeSpans.spans).toHaveLength(1);
      
      const span = scopeSpans.spans[0];
      expect(span.name).toBe("agent.run");
      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.traceId).not.toBe(span.spanId); // traceId != spanId
      expect(span.startTimeUnixNano).toBeDefined();
      expect(span.endTimeUnixNano).toBeDefined();
      expect(span.status.code).toBe(1); // OK
    });

    test("returns empty export when tracing disabled", () => {
      const plugin = new ObservabilityPlugin({ enableTracing: false });
      const otelData = plugin.exportOpenTelemetry();
      
      expect(otelData).toEqual({ resourceSpans: [] });
    });
  });

  describe("Reset Functionality", () => {
    test("clears all data on reset", async () => {
      // Generate some data
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      await plugin.hooks.beforeTool?.(ctx, { toolName: "test-tool", args: {} });
      await plugin.hooks.afterTool?.(ctx, { toolName: "test-tool", args: {}, result: "result" });
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "result", steps: [], sessionId: "test-session" } 
      });
      
      // Verify data exists
      expect(plugin.getTraces()).toHaveLength(1);
      expect(plugin.getMetrics().toolCalls).toHaveLength(1);
      
      // Reset
      plugin.reset();
      
      // Verify data is cleared
      expect(plugin.getTraces()).toHaveLength(0);
      const metrics = plugin.getMetrics();
      expect(metrics.totalTokens.input).toBe(0);
      expect(metrics.totalTokens.output).toBe(0);
      expect(metrics.totalLatencyMs).toBe(0);
      expect(metrics.toolCalls).toHaveLength(0);
      expect(metrics.llmCalls).toHaveLength(0);
    });
  });

  describe("Multiple Tool Calls", () => {
    test("handles multiple tool calls correctly", async () => {
      await plugin.hooks.beforeRun?.(ctx, { prompt: "test" });
      
      // First tool call
      await plugin.hooks.beforeTool?.(ctx, { toolName: "tool1", args: {} });
      await plugin.hooks.afterTool?.(ctx, { toolName: "tool1", args: {}, result: "result1" });
      
      // Second tool call
      await plugin.hooks.beforeTool?.(ctx, { toolName: "tool2", args: {} });
      await plugin.hooks.afterTool?.(ctx, { toolName: "tool2", args: {}, result: "result2" });
      
      await plugin.hooks.afterRun?.(ctx, { 
        result: { text: "result", steps: [], sessionId: "test-session" } 
      });
      
      const traces = plugin.getTraces();
      const rootSpan = traces[0];
      expect(rootSpan.children).toHaveLength(2);
      
      expect(rootSpan.children[0].name).toBe("tool.tool1");
      expect(rootSpan.children[1].name).toBe("tool.tool2");
      
      const metrics = plugin.getMetrics();
      expect(metrics.toolCalls).toHaveLength(2);
      expect(metrics.toolCalls[0].name).toBe("tool1");
      expect(metrics.toolCalls[1].name).toBe("tool2");
    });
  });
});