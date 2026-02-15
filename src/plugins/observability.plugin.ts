// =============================================================================
// ObservabilityPlugin — Tracing, metrics, and logging for agent runs
// =============================================================================

import { BasePlugin } from "./base.plugin.js";
import type { TracingPort, Span } from "../ports/tracing.port.js";
import type { MetricsPort } from "../ports/metrics.port.js";
import type { LoggingPort } from "../ports/logging.port.js";
import type {
  PluginHooks,
  PluginContext,
  BeforeRunParams,
  BeforeRunResult,
  AfterRunParams,
  BeforeToolParams,
  AfterToolParams,
  OnErrorParams,
} from "../ports/plugin.port.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ObservabilityPluginConfig {
  tracer?: TracingPort;
  metrics?: MetricsPort;
  logger?: LoggingPort;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────────────────────

export class ObservabilityPlugin extends BasePlugin {
  readonly name = "observability";

  private readonly tracer?: TracingPort;
  private readonly metrics?: MetricsPort;
  private readonly logger?: LoggingPort;
  private activeSpans = new Map<string, Span>();
  private toolStartTimes = new Map<string, number>();
  private toolCallCounter = 0;

  constructor(config: ObservabilityPluginConfig = {}) {
    super();
    this.tracer = config.tracer;
    this.metrics = config.metrics;
    this.logger = config.logger;
  }

  protected buildHooks(): PluginHooks {
    return {
      beforeRun: this.beforeRun.bind(this),
      afterRun: this.afterRun.bind(this),
      beforeTool: this.beforeTool.bind(this),
      afterTool: this.afterTool.bind(this),
      onError: this.onError.bind(this),
    };
  }

  // ── Hook implementations ──────────────────────────────────────────────────

  private async beforeRun(ctx: PluginContext, _params: BeforeRunParams): Promise<BeforeRunResult | void> {
    const span = this.tracer?.startSpan("agent.run");
    if (span) {
      span.setAttribute("session.id", ctx.sessionId);
      this.activeSpans.set(ctx.sessionId, span);
    }
    this.logger?.info("Agent run started", { sessionId: ctx.sessionId });
    this.metrics?.incrementCounter("agent.runs.total");
  }

  private async afterRun(ctx: PluginContext, params: AfterRunParams): Promise<void> {
    const span = this.activeSpans.get(ctx.sessionId);
    if (span) {
      span.setStatus("ok");
      span.end();
      this.activeSpans.delete(ctx.sessionId);
    }
    this.logger?.info("Agent run completed", { sessionId: ctx.sessionId });
    this.metrics?.incrementCounter("agent.runs.success");
  }

  private async beforeTool(ctx: PluginContext, params: BeforeToolParams): Promise<void> {
    const callId = ++this.toolCallCounter;
    const spanKey = `${ctx.sessionId}:tool:${callId}`;
    const parentSpan = this.activeSpans.get(ctx.sessionId);
    const span = this.tracer?.startSpan(`tool.${params.toolName}`, parentSpan);
    if (span) {
      span.setAttribute("tool.call.id", callId);
      this.activeSpans.set(spanKey, span);
    }
    this.toolStartTimes.set(spanKey, Date.now());
    this.logger?.debug("Tool call started", { sessionId: ctx.sessionId, tool: params.toolName });
    this.metrics?.incrementCounter("agent.tools.total", 1, { tool: params.toolName });
  }

  private async afterTool(ctx: PluginContext, params: AfterToolParams): Promise<void> {
    // Find the most recent tool span for this session
    const spanKey = this.findToolSpanKey(ctx.sessionId, params.toolName);
    const span = spanKey ? this.activeSpans.get(spanKey) : undefined;
    const startTime = spanKey ? this.toolStartTimes.get(spanKey) : undefined;
    const durationMs = startTime ? Date.now() - startTime : 0;
    if (span) {
      span.setStatus("ok");
      span.setAttribute("duration.ms", durationMs);
      span.end();
      this.activeSpans.delete(spanKey!);
    }
    if (spanKey) this.toolStartTimes.delete(spanKey);
    this.logger?.debug("Tool call completed", { tool: params.toolName, durationMs });
    this.metrics?.recordHistogram("agent.tool.duration.ms", durationMs, { tool: params.toolName });
  }

  private async onError(ctx: PluginContext, params: OnErrorParams): Promise<void> {
    const error = params.error instanceof Error ? params.error : new Error(String(params.error));
    // End all spans for this session (root + tool spans)
    for (const [key, span] of this.activeSpans) {
      if (key === ctx.sessionId || key.startsWith(`${ctx.sessionId}:`)) {
        span.setStatus("error", error.message);
        span.setAttribute("error.type", error.name);
        span.end();
        this.activeSpans.delete(key);
        this.toolStartTimes.delete(key);
      }
    }
    this.logger?.error("Agent error", { sessionId: ctx.sessionId, error: error.message });
    this.metrics?.incrementCounter("agent.runs.errors");
  }

  // Find the earliest (FIFO) tool span key matching session and tool name
  private findToolSpanKey(sessionId: string, toolName: string): string | undefined {
    const prefix = `${sessionId}:tool:`;
    for (const [key, span] of this.activeSpans) {
      if (key.startsWith(prefix) && span.name === `tool.${toolName}`) {
        return key;
      }
    }
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createObservabilityPlugin(config?: ObservabilityPluginConfig): ObservabilityPlugin {
  return new ObservabilityPlugin(config);
}
