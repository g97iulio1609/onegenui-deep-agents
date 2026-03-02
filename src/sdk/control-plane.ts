/**
 * Unified Control Plane — local operational surface for Gauss.
 *
 * Provides a lightweight dashboard and JSON API for telemetry, approvals, and
 * cost visibility. Includes optional auth, persistence, filtering, and timeline
 * snapshots.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { dirname } from "node:path";

import { ValidationError } from "./errors.js";
import type { Disposable, ProviderType } from "./types.js";
import type { Telemetry } from "./telemetry.js";
import type { ApprovalManager } from "./approval.js";
import { estimateCost } from "./tokens.js";
import {
  evaluatePolicyDiff,
  evaluatePolicyGate,
  evaluatePolicyRolloutGuardrails,
  explainRoutingTarget,
  type PolicyDiffSummary,
  type ResolveRoutingTargetOptions,
  type PolicyGateSummary,
  type PolicyRolloutGateResult,
  type PolicyRolloutGuardrails,
  type RoutingDecisionExplanation,
  type RoutingPolicy,
} from "./routing-policy.js";

class ControlPlaneForbiddenError extends Error {}

const PROVIDER_VALUES: ProviderType[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "ollama",
  "deepseek",
  "openrouter",
  "together",
  "fireworks",
  "mistral",
  "perplexity",
  "xai",
];

export interface ControlPlaneUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface ControlPlaneSnapshot {
  generatedAt: string;
  context: ControlPlaneContext;
  spans: unknown;
  metrics: unknown;
  pendingApprovals: unknown;
  latestCost: ReturnType<typeof estimateCost> | null;
  latestExplainTraceId: string | null;
}

export type ControlPlaneSection = "spans" | "metrics" | "pendingApprovals" | "latestCost";

export interface ControlPlaneContext {
  tenantId?: string;
  sessionId?: string;
  runId?: string;
}

export interface ControlPlaneAuthClaims {
  tenantId?: string;
  allowedSessionIds?: string[];
  allowedRunIds?: string[];
  roles?: string[];
}

export interface ControlPlaneOptions {
  telemetry?: Pick<Telemetry, "exportSpans" | "exportMetrics">;
  approvals?: Pick<ApprovalManager, "listPending">;
  model?: string;
  routingPolicy?: RoutingPolicy;
  authToken?: string;
  authClaims?: ControlPlaneAuthClaims;
  persistPath?: string;
  historyLimit?: number;
  streamReplayLimit?: number;
  context?: ControlPlaneContext;
}

export interface ControlPlaneTimelinePoint {
  generatedAt: string;
  spanCount: number;
  pendingApprovalsCount: number;
  totalCostUsd: number;
  latestExplainTraceId?: string | null;
}

export type ControlPlaneStreamChannel = "snapshot" | "timeline" | "dag";

export interface ControlPlaneStreamEvent {
  id: number;
  event: ControlPlaneStreamChannel;
  generatedAt: string;
  context: ControlPlaneContext;
  payload: unknown;
}

export interface ControlPlaneOpsCapabilities {
  sections: ControlPlaneSection[];
  channels: ControlPlaneStreamChannel[];
  supportsMultiplex: boolean;
  supportsReplayCursor: boolean;
  supportsChannelRbac: boolean;
  supportsOpsSummary: boolean;
  supportsOpsTenants: boolean;
  supportsPolicyExplain: boolean;
  supportsPolicyExplainBatch: boolean;
  supportsPolicyExplainTraces: boolean;
  supportsPolicyExplainDiff: boolean;
  supportsPolicyLifecycle: boolean;
  supportsPolicyLifecycleRbac: boolean;
  supportsPolicyDriftMonitoring: boolean;
  supportsPolicyDriftScheduler: boolean;
  supportsPolicyDriftWindows: boolean;
  supportsPolicyDriftAlertSinks: boolean;
  hostedDashboardPath: string;
  hostedTenantDashboardPath: string;
  policyExplainPath: string;
  policyExplainBatchPath: string;
  policyExplainSimulatePath: string;
  policyExplainTracePath: string;
  policyExplainDiffPath: string;
  policyLifecycleBasePath: string;
  policyLifecycleRoleParam: string;
  policyLifecycleAuditFields: string[];
  policyDriftPath: string;
  policyDriftSchedulePath: string;
  policyDriftScheduleRunPath: string;
}

type ControlPlanePolicyLifecycleStatus = "draft" | "validated" | "approved" | "promoted";

interface ControlPlanePolicyLifecycleAudit {
  draftedByRole?: string;
  draftedBy?: string;
  draftComment?: string;
  validatedByRole?: string;
  validatedBy?: string;
  validationComment?: string;
  approvedByRole?: string;
  approvedBy?: string;
  approvalComment?: string;
  promotedByRole?: string;
  promotedBy?: string;
  promotionComment?: string;
}

interface ControlPlanePolicyLifecycleVersion {
  versionId: string;
  status: ControlPlanePolicyLifecycleStatus;
  createdAt: string;
  validatedAt?: string;
  approvedAt?: string;
  promotedAt?: string;
  policy: RoutingPolicy;
  validation?: PolicyGateSummary;
  audit?: ControlPlanePolicyLifecycleAudit;
}

interface ControlPlanePolicyDriftScheduleConfig {
  enabled: boolean;
  intervalMs: number;
  window: ControlPlanePolicyDriftWindow;
  scenariosRaw: string;
  baselinePolicyRaw?: string;
  candidatePolicyRaw?: string;
  baselineVersionId?: string;
  candidateVersionId?: string;
  guardrails: PolicyRolloutGuardrails;
  updatedAt: string;
  lastRunAt?: string;
}

interface ControlPlanePolicyDriftScheduleRun extends ControlPlanePolicyDriftAlert {
  runId: string;
  traceId: string;
}

export interface ControlPlanePolicyExplainTrace {
  traceId: string;
  generatedAt: string;
  mode: "single" | "batch" | "simulate" | "diff" | "drift";
  payload: unknown;
}

export interface ControlPlanePolicyDriftAlert {
  ok: boolean;
  alert: boolean;
  generatedAt: string;
  window: ControlPlanePolicyDriftWindow;
  baselineVersionId: string | null;
  candidateVersionId: string | null;
  diff: PolicyDiffSummary;
  guardrails: PolicyRolloutGateResult;
  sinksTriggered: string[];
}

export type ControlPlanePolicyDriftWindow = "custom" | "last_1h" | "last_24h" | "last_7d";

export interface ControlPlaneOpsHealth {
  status: "ok";
  generatedAt: string;
  historySize: number;
  streamBufferSize: number;
}

export interface ControlPlaneOpsSummary {
  status: "ok";
  generatedAt: string;
  historySize: number;
  streamBufferSize: number;
  spansCount: number;
  pendingApprovalsCount: number;
  latestTotalCostUsd: number;
  tenantCount: number;
  sessionCount: number;
  runCount: number;
}

export interface ControlPlaneOpsTenantSummary {
  tenantId: string;
  snapshotCount: number;
  spansCount: number;
  pendingApprovalsCount: number;
  latestTotalCostUsd: number;
  sessionCount: number;
  runCount: number;
  latestGeneratedAt: string;
}

export class ControlPlane implements Disposable {
  private readonly telemetry?: Pick<Telemetry, "exportSpans" | "exportMetrics">;
  private readonly approvals?: Pick<ApprovalManager, "listPending">;
  private model: string;
  private routingPolicy?: RoutingPolicy;
  private authToken?: string;
  private authClaims?: ControlPlaneAuthClaims;
  private readonly persistPath?: string;
  private readonly historyLimit: number;
  private readonly streamReplayLimit: number;
  private context: ControlPlaneContext;
  private latestCost: ReturnType<typeof estimateCost> | null = null;
  private readonly history: ControlPlaneSnapshot[] = [];
  private nextStreamEventId = 1;
  private readonly streamEvents: ControlPlaneStreamEvent[] = [];
  private readonly explainTraces: ControlPlanePolicyExplainTrace[] = [];
  private nextExplainTraceId = 1;
  private latestExplainTraceId: string | null = null;
  private readonly policyDriftAlertHooks: Array<(alert: ControlPlanePolicyDriftAlert) => void> = [];
  private readonly policyDriftSinks: string[] = [];
  private policyDriftScheduleConfig: ControlPlanePolicyDriftScheduleConfig | null = null;
  private readonly policyDriftRuns: ControlPlanePolicyDriftScheduleRun[] = [];
  private nextPolicyDriftRunId = 1;
  private readonly policyLifecycleVersions: ControlPlanePolicyLifecycleVersion[] = [];
  private nextPolicyLifecycleVersion = 1;
  private activePolicyVersionId: string | null = null;
  private server: Server | null = null;

  constructor(options: ControlPlaneOptions = {}) {
    this.telemetry = options.telemetry;
    this.approvals = options.approvals;
    this.model = options.model ?? "gpt-5.2";
    this.routingPolicy = options.routingPolicy;
    this.authToken = options.authToken;
    this.authClaims = options.authClaims;
    this.persistPath = options.persistPath;
    this.historyLimit = options.historyLimit ?? 200;
    this.streamReplayLimit = options.streamReplayLimit ?? 500;
    this.context = { ...(options.context ?? {}) };
  }

  withModel(model: string): this {
    this.model = model;
    return this;
  }

  withRoutingPolicy(routingPolicy?: RoutingPolicy): this {
    this.routingPolicy = routingPolicy;
    return this;
  }

  withAuthToken(token?: string): this {
    this.authToken = token;
    return this;
  }

  withAuthClaims(claims?: ControlPlaneAuthClaims): this {
    this.authClaims = claims;
    return this;
  }

  withContext(context: ControlPlaneContext): this {
    this.assertContextAllowed(context);
    this.context = { ...context };
    return this;
  }

  onPolicyDriftAlert(hook: (alert: ControlPlanePolicyDriftAlert) => void): () => void {
    this.policyDriftAlertHooks.push(hook);
    return () => {
      const index = this.policyDriftAlertHooks.indexOf(hook);
      if (index >= 0) this.policyDriftAlertHooks.splice(index, 1);
    };
  }

  registerPolicyDriftSink(sinkId: string): this {
    const normalized = sinkId.trim();
    if (!normalized) {
      throw new ValidationError("sinkId must be a non-empty string", "sinkId");
    }
    if (!this.policyDriftSinks.includes(normalized)) {
      this.policyDriftSinks.push(normalized);
    }
    return this;
  }

  setCostUsage(usage: ControlPlaneUsage): this {
    this.latestCost = estimateCost(this.model, usage);
    return this;
  }

  snapshot(): ControlPlaneSnapshot;
  snapshot(section: ControlPlaneSection): Record<string, unknown>;
  snapshot(section?: ControlPlaneSection): ControlPlaneSnapshot | Record<string, unknown> {
    const full = this.captureSnapshot();
    if (!section) return full;
    return {
      generatedAt: full.generatedAt,
      context: full.context,
      [section]: full[section],
    };
  }

  getHistory(filters?: ControlPlaneContext): ControlPlaneSnapshot[] {
    return this.filterHistory(filters);
  }

  getTimeline(filters?: ControlPlaneContext): ControlPlaneTimelinePoint[] {
    return this.filterHistory(filters).map((item) => ({
      generatedAt: item.generatedAt,
      spanCount: Array.isArray(item.spans) ? item.spans.length : 0,
      pendingApprovalsCount: Array.isArray(item.pendingApprovals) ? item.pendingApprovals.length : 0,
      totalCostUsd: item.latestCost?.totalCostUsd ?? 0,
      latestExplainTraceId: item.latestExplainTraceId,
    }));
  }

  getDag(filters?: ControlPlaneContext): { nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string }> } {
    const filtered = this.filterHistory(filters);
    const latest = filtered[filtered.length - 1];
    if (!latest || !Array.isArray(latest.spans)) {
      return { nodes: [], edges: [] };
    }
    const nodes = latest.spans.map((span, i) => ({
      id: String(i),
      label: this.spanLabel(span, i),
    }));
    const edges = nodes.slice(1).map((node, i) => ({
      from: String(i),
      to: node.id,
    }));
    return { nodes, edges };
  }

  async startServer(host = "127.0.0.1", port = 4200): Promise<{ url: string }> {
    if (this.server) {
      const addr = this.server.address();
      if (addr && typeof addr !== "string") {
        return { url: `http://${host}:${addr.port}` };
      }
      return { url: `http://${host}:${port}` };
    }

    this.server = createServer((req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Bad request");
        return;
      }

      const parsed = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);
      const pathname = parsed.pathname;

      if (pathname.startsWith("/api/") && !this.isAuthorized(req, parsed)) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      try {
        if (pathname === "/api/snapshot") {
          const section = parsed.searchParams.get("section");
          const payload = section
            ? this.snapshot(this.parseSection(section))
            : this.snapshot();
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(payload, null, 2));
          return;
        }

        if (pathname === "/api/history") {
          const filters = this.applyAuthClaims(this.parseContextFilters(parsed.searchParams));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.getHistory(filters), null, 2));
          return;
        }

        if (pathname === "/api/timeline") {
          const filters = this.applyAuthClaims(this.parseContextFilters(parsed.searchParams));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.getTimeline(filters), null, 2));
          return;
        }

        if (pathname === "/api/dag") {
          const filters = this.applyAuthClaims(this.parseContextFilters(parsed.searchParams));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.getDag(filters), null, 2));
          return;
        }

        if (pathname === "/api/ops/capabilities") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsCapabilities(), null, 2));
          return;
        }

        if (pathname === "/api/ops/health") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsHealth(), null, 2));
          return;
        }

        if (pathname === "/api/ops/summary") {
          const filters = this.applyAuthClaims(this.parseContextFilters(parsed.searchParams));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsSummary(filters), null, 2));
          return;
        }

        if (pathname === "/api/ops/tenants") {
          const filters = this.applyAuthClaims(this.parseContextFilters(parsed.searchParams));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsTenants(filters), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/explain") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyExplain(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/explain/batch") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyExplainBatch(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/explain/simulate") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyExplainSimulation(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/explain/diff") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyExplainDiff(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/explain/traces") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyExplainTraces(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/lifecycle/draft") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyLifecycleDraft(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/lifecycle/validate") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyLifecycleValidate(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/lifecycle/approve") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyLifecycleApprove(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/lifecycle/promote") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyLifecyclePromote(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/lifecycle/versions") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyLifecycleVersions(), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/drift/schedule/set") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyDriftScheduleSet(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/drift/schedule/run") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyDriftScheduleRun(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/drift/schedule") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyDriftSchedule(), null, 2));
          return;
        }

        if (pathname === "/api/ops/policy/drift") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(this.opsPolicyDrift(parsed.searchParams), null, 2));
          return;
        }

        if (pathname === "/api/stream") {
          const filters = this.applyAuthClaims(this.parseContextFilters(parsed.searchParams));
          const channels = this.parseStreamChannels(parsed.searchParams);
          for (const channel of channels) {
            this.assertChannelAllowed(channel);
          }
          const once = parsed.searchParams.get("once") === "1";
          const lastEventId = this.parseLastEventId(req, parsed.searchParams);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          const replayed = this.replayStreamEvents(res, channels, filters, lastEventId);
          if (once && replayed > 0) {
            res.end();
            return;
          }
          this.emitStreamBatch(res, channels, filters);
          if (once) {
            res.end();
            return;
          }

          const timer = setInterval(() => {
            if (res.writableEnded || res.destroyed) return;
            this.emitStreamBatch(res, channels, filters);
          }, 1000);
          const cleanup = () => clearInterval(timer);
          req.on("close", cleanup);
          req.on("aborted", cleanup);
          return;
        }

        if (pathname === "/") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(this.renderDashboardHtml());
          return;
        }

        if (pathname === "/ops") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(this.renderHostedOpsHtml());
          return;
        }

        if (pathname === "/ops/tenants") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(this.renderHostedTenantOpsHtml());
          return;
        }

        res.statusCode = 404;
        res.end("Not found");
      } catch (error) {
        if (error instanceof ControlPlaneForbiddenError) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        const message = error instanceof Error ? error.message : "Internal error";
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: message }));
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(port, host, () => resolve());
    });

    const addr = this.server.address();
    if (!addr || typeof addr === "string") {
      return { url: `http://${host}:${port}` };
    }
    return { url: `http://${host}:${addr.port}` };
  }

  async stopServer(): Promise<void> {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      srv.close((err) => (err ? reject(err) : resolve()));
    });
  }

  destroy(): void {
    void this.stopServer();
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  private captureSnapshot(): ControlPlaneSnapshot {
    this.assertContextAllowed(this.context);
    const snapshot: ControlPlaneSnapshot = {
      generatedAt: new Date().toISOString(),
      context: { ...this.context },
      spans: this.telemetry?.exportSpans() ?? [],
      metrics: this.telemetry?.exportMetrics() ?? {},
      pendingApprovals: this.approvals?.listPending() ?? [],
      latestCost: this.latestCost,
      latestExplainTraceId: this.latestExplainTraceId,
    };
    this.history.push(snapshot);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    if (this.persistPath) {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      appendFileSync(this.persistPath, `${JSON.stringify(snapshot)}\n`, "utf8");
    }
    return snapshot;
  }

  private parseSection(section: string): ControlPlaneSection {
    if (
      section === "spans" ||
      section === "metrics" ||
      section === "pendingApprovals" ||
      section === "latestCost"
    ) {
      return section;
    }
    throw new ValidationError(`Unknown section "${section}"`, "section");
  }

  private parseStreamChannel(channel: string | null): ControlPlaneStreamChannel {
    if (channel === null || channel === "snapshot") return "snapshot";
    if (channel === "timeline" || channel === "dag") return channel;
    throw new ValidationError(`Unknown stream channel "${channel}"`, "channel");
  }

  private parseStreamChannels(params: URLSearchParams): ControlPlaneStreamChannel[] {
    const channelsParam = params.get("channels");
    if (!channelsParam) {
      return [this.parseStreamChannel(params.get("channel"))];
    }
    const channels = channelsParam
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => this.parseStreamChannel(value));
    if (channels.length === 0) {
      return ["snapshot"];
    }
    return [...new Set(channels)];
  }

  private parseLastEventId(req: IncomingMessage, params: URLSearchParams): number | null {
    const fromQuery = params.get("lastEventId");
    const fromHeader = req.headers["last-event-id"];
    const raw = fromQuery ?? (typeof fromHeader === "string" ? fromHeader : null);
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ValidationError(`Invalid lastEventId "${raw}"`, "lastEventId");
    }
    return parsed;
  }

  private parseContextFilters(params: URLSearchParams): ControlPlaneContext {
    return {
      tenantId: params.get("tenant") ?? undefined,
      sessionId: params.get("session") ?? undefined,
      runId: params.get("run") ?? undefined,
    };
  }

  private parsePolicyProvider(value: string): ProviderType {
    if (!PROVIDER_VALUES.includes(value as ProviderType)) {
      throw new ValidationError(`Unknown provider "${value}"`, "provider");
    }
    return value as ProviderType;
  }

  private parseOptionalNumber(raw: string | null, key: string): number | undefined {
    if (raw === null || raw.trim().length === 0) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new ValidationError(`Invalid ${key} "${raw}"`, key);
    }
    return parsed;
  }

  private parsePolicyExplainScenario(raw: {
    provider?: unknown;
    model?: unknown;
    available?: unknown;
    cost?: unknown;
    rpm?: unknown;
    hour?: unknown;
    tags?: unknown;
  }): {
    provider: ProviderType;
    model: string;
    options: ResolveRoutingTargetOptions;
  } {
    const provider = this.parsePolicyProvider(
      typeof raw.provider === "string" && raw.provider.trim().length > 0
        ? raw.provider
        : "openai",
    );
    const model = typeof raw.model === "string" && raw.model.trim().length > 0
      ? raw.model
      : "gpt-5.2";

    const availableValues = Array.isArray(raw.available)
      ? raw.available
      : typeof raw.available === "string"
        ? raw.available.split(",")
        : [];
    const availableProviders = availableValues.length > 0
      ? availableValues
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
        .map((value) => this.parsePolicyProvider(value))
      : undefined;
    const tagValues = Array.isArray(raw.tags)
      ? raw.tags
      : typeof raw.tags === "string"
        ? raw.tags.split(",")
        : [];
    const governanceTags = tagValues.length > 0
      ? tagValues
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
      : undefined;

    const cost = this.parseOptionalNumber(
      raw.cost !== undefined && raw.cost !== null ? String(raw.cost) : null,
      "cost",
    );
    const rpm = this.parseOptionalNumber(
      raw.rpm !== undefined && raw.rpm !== null ? String(raw.rpm) : null,
      "rpm",
    );
    const hour = this.parseOptionalNumber(
      raw.hour !== undefined && raw.hour !== null ? String(raw.hour) : null,
      "hour",
    );

    return {
      provider,
      model,
      options: {
        availableProviders,
        estimatedCostUsd: cost,
        currentRequestsPerMinute: rpm,
        currentHourUtc: hour,
        governanceTags,
      },
    };
  }

  private parsePolicyExplainOptions(params: URLSearchParams): {
    provider: ProviderType;
    model: string;
    options: ResolveRoutingTargetOptions;
  } {
    return this.parsePolicyExplainScenario({
      provider: params.get("provider"),
      model: params.get("model"),
      available: params.get("available"),
      cost: params.get("cost"),
      rpm: params.get("rpm"),
      hour: params.get("hour"),
      tags: params.get("tags"),
    });
  }

  private parsePolicyExplainBatchScenarios(params: URLSearchParams): Array<{
    provider: ProviderType;
    model: string;
    options: ResolveRoutingTargetOptions;
  }> {
    const raw = params.get("scenarios");
    if (!raw) {
      throw new ValidationError("Missing scenarios query parameter", "scenarios");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ValidationError("Invalid scenarios JSON payload", "scenarios");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new ValidationError("scenarios must be a non-empty array", "scenarios");
    }
    return parsed.map((item, index) => {
      if (typeof item !== "object" || item === null) {
        throw new ValidationError(`Scenario ${index} must be an object`, "scenarios");
      }
      return this.parsePolicyExplainScenario(item as {
        provider?: unknown;
        model?: unknown;
        available?: unknown;
        cost?: unknown;
        rpm?: unknown;
        hour?: unknown;
        tags?: unknown;
      });
    });
  }

  private parseLifecyclePolicy(params: URLSearchParams): RoutingPolicy {
    const raw = params.get("policy");
    if (!raw) {
      throw new ValidationError("Missing policy query parameter", "policy");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ValidationError("Invalid policy JSON payload", "policy");
    }
    if (!parsed || typeof parsed !== "object") {
      throw new ValidationError("policy must be a JSON object", "policy");
    }
    return parsed as RoutingPolicy;
  }

  private parseOptionalPolicyFromQuery(params: URLSearchParams, key: string): RoutingPolicy | undefined {
    const raw = params.get(key);
    if (!raw || raw.trim().length === 0) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ValidationError(`Invalid ${key} JSON payload`, key);
    }
    if (!parsed || typeof parsed !== "object") {
      throw new ValidationError(`${key} must be a JSON object`, key);
    }
    return parsed as RoutingPolicy;
  }

  private parsePolicyDriftGuardrails(params: URLSearchParams): PolicyRolloutGuardrails {
    const maxChanged = this.parseOptionalNumber(params.get("maxChanged"), "maxChanged");
    const maxRegressions = this.parseOptionalNumber(params.get("maxRegressions"), "maxRegressions");
    const minCandidatePassRate = this.parseOptionalNumber(params.get("minCandidatePassRate"), "minCandidatePassRate");
    return {
      ...(maxChanged !== undefined ? { maxChanged } : {}),
      ...(maxRegressions !== undefined ? { maxRegressions } : {}),
      ...(minCandidatePassRate !== undefined ? { minCandidatePassRate } : {}),
    };
  }

  private parsePolicyDriftWindow(raw: string | null): ControlPlanePolicyDriftWindow {
    if (!raw || raw.trim().length === 0) return "custom";
    const normalized = raw.trim().toLowerCase();
    if (normalized === "last_1h" || normalized === "last_24h" || normalized === "last_7d" || normalized === "custom") {
      return normalized;
    }
    throw new ValidationError(`Invalid policy drift window "${raw}"`, "window");
  }

  private cloneRoutingPolicy(policy: RoutingPolicy): RoutingPolicy {
    return JSON.parse(JSON.stringify(policy)) as RoutingPolicy;
  }

  private summarizeLifecycleVersion(version: ControlPlanePolicyLifecycleVersion): {
    versionId: string;
    status: ControlPlanePolicyLifecycleStatus;
    createdAt: string;
    validatedAt?: string;
    approvedAt?: string;
    promotedAt?: string;
    hasValidation: boolean;
    validation?: PolicyGateSummary;
    audit?: ControlPlanePolicyLifecycleAudit;
  } {
    return {
      versionId: version.versionId,
      status: version.status,
      createdAt: version.createdAt,
      validatedAt: version.validatedAt,
      approvedAt: version.approvedAt,
      promotedAt: version.promotedAt,
      hasValidation: !!version.validation,
      validation: version.validation,
      audit: version.audit,
    };
  }

  private findLifecycleVersion(versionId: string): ControlPlanePolicyLifecycleVersion {
    const found = this.policyLifecycleVersions.find((item) => item.versionId === versionId);
    if (!found) {
      throw new ValidationError(`Unknown lifecycle version "${versionId}"`, "version");
    }
    return found;
  }

  private resolveLifecycleActor(
    action: "draft" | "validate" | "approve" | "promote",
    allowedRoles: string[],
    params: URLSearchParams,
  ): { role: string; actor?: string; comment?: string } {
    const requestedRoleRaw = params.get("role");
    const requestedRole = requestedRoleRaw?.trim().toLowerCase();

    const claimRoles = (this.authClaims?.roles ?? [])
      .map((role) => role.trim().toLowerCase())
      .filter((role) => role.length > 0);

    if (claimRoles.length > 0) {
      if (requestedRole && !claimRoles.includes(requestedRole)) {
        throw new ControlPlaneForbiddenError(`Forbidden lifecycle role "${requestedRole}"`);
      }
      if (requestedRole && !allowedRoles.includes(requestedRole)) {
        throw new ControlPlaneForbiddenError(`Forbidden lifecycle action "${action}"`);
      }
      const effectiveRole = requestedRole ?? claimRoles.find((role) => allowedRoles.includes(role));
      if (!effectiveRole) {
        throw new ControlPlaneForbiddenError(`Forbidden lifecycle action "${action}"`);
      }
      const actor = params.get("actor")?.trim() || undefined;
      const comment = params.get("comment")?.trim() || undefined;
      return { role: effectiveRole, actor, comment };
    }

    if (requestedRole && !allowedRoles.includes(requestedRole)) {
      throw new ControlPlaneForbiddenError(`Forbidden lifecycle action "${action}"`);
    }
    const actor = params.get("actor")?.trim() || undefined;
    const comment = params.get("comment")?.trim() || undefined;
    return { role: requestedRole ?? allowedRoles[0]!, actor, comment };
  }

  private mergeLifecycleAudit(
    version: ControlPlanePolicyLifecycleVersion,
    patch: Partial<ControlPlanePolicyLifecycleAudit>,
  ): void {
    version.audit = { ...(version.audit ?? {}), ...patch };
  }

  private opsPolicyLifecycleDraft(params: URLSearchParams): {
    ok: true;
    version: ReturnType<ControlPlane["summarizeLifecycleVersion"]>;
  } {
    const actor = this.resolveLifecycleActor("draft", ["author", "operator", "admin"], params);
    const now = new Date().toISOString();
    const version: ControlPlanePolicyLifecycleVersion = {
      versionId: `policy-v${this.nextPolicyLifecycleVersion++}`,
      status: "draft",
      createdAt: now,
      policy: this.cloneRoutingPolicy(this.parseLifecyclePolicy(params)),
      audit: {
        draftedByRole: actor.role,
        draftedBy: actor.actor,
        draftComment: actor.comment,
      },
    };
    this.policyLifecycleVersions.push(version);
    return {
      ok: true,
      version: this.summarizeLifecycleVersion(version),
    };
  }

  private opsPolicyLifecycleValidate(params: URLSearchParams): {
    ok: boolean;
    version: ReturnType<ControlPlane["summarizeLifecycleVersion"]>;
    validation: PolicyGateSummary;
  } {
    const actor = this.resolveLifecycleActor("validate", ["author", "reviewer", "operator", "admin"], params);
    const versionId = params.get("version");
    if (!versionId) {
      throw new ValidationError("Missing version query parameter", "version");
    }
    const version = this.findLifecycleVersion(versionId);
    const scenarios = this.parsePolicyExplainBatchScenarios(params).map((scenario) => ({
      provider: scenario.provider,
      model: scenario.model,
      options: scenario.options,
    }));
    const validation = evaluatePolicyGate(version.policy, scenarios);
    version.validation = validation;
    this.mergeLifecycleAudit(version, {
      validatedByRole: actor.role,
      validatedBy: actor.actor,
      validationComment: actor.comment,
    });
    if (validation.failed === 0) {
      version.status = "validated";
      version.validatedAt = new Date().toISOString();
    }
    return {
      ok: validation.failed === 0,
      version: this.summarizeLifecycleVersion(version),
      validation,
    };
  }

  private opsPolicyLifecycleApprove(params: URLSearchParams): {
    ok: boolean;
    version: ReturnType<ControlPlane["summarizeLifecycleVersion"]>;
    error?: string;
  } {
    const actor = this.resolveLifecycleActor("approve", ["reviewer", "operator", "admin"], params);
    const versionId = params.get("version");
    if (!versionId) {
      throw new ValidationError("Missing version query parameter", "version");
    }
    const version = this.findLifecycleVersion(versionId);
    if (!version.validation || version.validation.failed > 0 || version.status !== "validated") {
      return {
        ok: false,
        version: this.summarizeLifecycleVersion(version),
        error: "version must pass validation before approval",
      };
    }
    version.status = "approved";
    version.approvedAt = new Date().toISOString();
    this.mergeLifecycleAudit(version, {
      approvedByRole: actor.role,
      approvedBy: actor.actor,
      approvalComment: actor.comment,
    });
    return {
      ok: true,
      version: this.summarizeLifecycleVersion(version),
    };
  }

  private opsPolicyLifecyclePromote(params: URLSearchParams): {
    ok: boolean;
    activeVersionId: string | null;
    version: ReturnType<ControlPlane["summarizeLifecycleVersion"]>;
    error?: string;
  } {
    const actor = this.resolveLifecycleActor("promote", ["promoter", "operator", "admin"], params);
    const versionId = params.get("version");
    if (!versionId) {
      throw new ValidationError("Missing version query parameter", "version");
    }
    const version = this.findLifecycleVersion(versionId);
    if (version.status !== "approved") {
      return {
        ok: false,
        activeVersionId: this.activePolicyVersionId,
        version: this.summarizeLifecycleVersion(version),
        error: "version must be approved before promotion",
      };
    }
    for (const item of this.policyLifecycleVersions) {
      if (item.versionId !== versionId && item.status === "promoted") {
        item.status = "approved";
      }
    }
    version.status = "promoted";
    version.promotedAt = new Date().toISOString();
    this.mergeLifecycleAudit(version, {
      promotedByRole: actor.role,
      promotedBy: actor.actor,
      promotionComment: actor.comment,
    });
    this.activePolicyVersionId = version.versionId;
    this.routingPolicy = this.cloneRoutingPolicy(version.policy);
    return {
      ok: true,
      activeVersionId: this.activePolicyVersionId,
      version: this.summarizeLifecycleVersion(version),
    };
  }

  private opsPolicyLifecycleVersions(): {
    ok: true;
    activeVersionId: string | null;
    versions: Array<ReturnType<ControlPlane["summarizeLifecycleVersion"]>>;
  } {
    return {
      ok: true,
      activeVersionId: this.activePolicyVersionId,
      versions: this.policyLifecycleVersions.map((item) => this.summarizeLifecycleVersion(item)),
    };
  }

  private buildStreamEvent(
    channel: ControlPlaneStreamChannel,
    filters: ControlPlaneContext,
    snap: ControlPlaneSnapshot,
  ): ControlPlaneStreamEvent {
    const payload =
      channel === "timeline"
        ? this.getTimeline(filters)
        : channel === "dag"
          ? this.getDag(filters)
          : this.filterHistory(filters).slice(-1)[0] ?? snap;
    const event: ControlPlaneStreamEvent = {
      id: this.nextStreamEventId++,
      event: channel,
      generatedAt: snap.generatedAt,
      context: { ...snap.context },
      payload,
    };
    this.streamEvents.push(event);
    if (this.streamEvents.length > this.streamReplayLimit) {
      this.streamEvents.shift();
    }
    return event;
  }

  private writeSseEvent(res: import("node:http").ServerResponse, event: ControlPlaneStreamEvent): void {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.event}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  private opsCapabilities(): ControlPlaneOpsCapabilities {
    return {
      sections: ["spans", "metrics", "pendingApprovals", "latestCost"],
      channels: ["snapshot", "timeline", "dag"],
      supportsMultiplex: true,
      supportsReplayCursor: true,
      supportsChannelRbac: true,
      supportsOpsSummary: true,
      supportsOpsTenants: true,
      supportsPolicyExplain: true,
      supportsPolicyExplainBatch: true,
      supportsPolicyExplainTraces: true,
      supportsPolicyExplainDiff: true,
      supportsPolicyLifecycle: true,
      supportsPolicyLifecycleRbac: true,
      supportsPolicyDriftMonitoring: true,
      supportsPolicyDriftScheduler: true,
      supportsPolicyDriftWindows: true,
      supportsPolicyDriftAlertSinks: true,
      hostedDashboardPath: "/ops",
      hostedTenantDashboardPath: "/ops/tenants",
      policyExplainPath: "/api/ops/policy/explain",
      policyExplainBatchPath: "/api/ops/policy/explain/batch",
      policyExplainSimulatePath: "/api/ops/policy/explain/simulate",
      policyExplainTracePath: "/api/ops/policy/explain/traces",
      policyExplainDiffPath: "/api/ops/policy/explain/diff",
      policyLifecycleBasePath: "/api/ops/policy/lifecycle",
      policyLifecycleRoleParam: "role",
      policyLifecycleAuditFields: [
        "draftedByRole",
        "validatedByRole",
        "approvedByRole",
        "promotedByRole",
      ],
      policyDriftPath: "/api/ops/policy/drift",
      policyDriftSchedulePath: "/api/ops/policy/drift/schedule",
      policyDriftScheduleRunPath: "/api/ops/policy/drift/schedule/run",
    };
  }

  private opsHealth(): ControlPlaneOpsHealth {
    return {
      status: "ok",
      generatedAt: new Date().toISOString(),
      historySize: this.history.length,
      streamBufferSize: this.streamEvents.length,
    };
  }

  private opsSummary(filters?: ControlPlaneContext): ControlPlaneOpsSummary {
    const history = this.filterHistory(filters);
    const latest = history[history.length - 1];
    const spans = latest?.spans;
    const pendingApprovals = latest?.pendingApprovals;
    const scopedStreamBufferSize = filters && (filters.tenantId || filters.sessionId || filters.runId)
      ? this.streamEvents.filter((event) => this.matchesContext(event.context, filters)).length
      : this.streamEvents.length;

    const tenants = new Set<string>();
    const sessions = new Set<string>();
    const runs = new Set<string>();
    for (const item of history) {
      if (item.context.tenantId) tenants.add(item.context.tenantId);
      if (item.context.sessionId) sessions.add(item.context.sessionId);
      if (item.context.runId) runs.add(item.context.runId);
    }

    return {
      status: "ok",
      generatedAt: new Date().toISOString(),
      historySize: history.length,
      streamBufferSize: scopedStreamBufferSize,
      spansCount: Array.isArray(spans) ? spans.length : 0,
      pendingApprovalsCount: Array.isArray(pendingApprovals) ? pendingApprovals.length : 0,
      latestTotalCostUsd: latest?.latestCost?.totalCostUsd ?? 0,
      tenantCount: tenants.size,
      sessionCount: sessions.size,
      runCount: runs.size,
    };
  }

  private opsTenants(filters?: ControlPlaneContext): ControlPlaneOpsTenantSummary[] {
    const history = this.filterHistory(filters);
    const grouped = new Map<string, {
      snapshotCount: number;
      spansCount: number;
      pendingApprovalsCount: number;
      latestTotalCostUsd: number;
      latestGeneratedAt: string;
      sessions: Set<string>;
      runs: Set<string>;
    }>();

    for (const item of history) {
      const tenantId = item.context.tenantId ?? "_unscoped";
      const current = grouped.get(tenantId) ?? {
        snapshotCount: 0,
        spansCount: 0,
        pendingApprovalsCount: 0,
        latestTotalCostUsd: 0,
        latestGeneratedAt: item.generatedAt,
        sessions: new Set<string>(),
        runs: new Set<string>(),
      };
      current.snapshotCount += 1;
      current.spansCount += Array.isArray(item.spans) ? item.spans.length : 0;
      current.pendingApprovalsCount += Array.isArray(item.pendingApprovals) ? item.pendingApprovals.length : 0;
      if (item.latestCost?.totalCostUsd !== undefined) {
        current.latestTotalCostUsd = item.latestCost.totalCostUsd;
      }
      if (item.generatedAt >= current.latestGeneratedAt) {
        current.latestGeneratedAt = item.generatedAt;
      }
      if (item.context.sessionId) current.sessions.add(item.context.sessionId);
      if (item.context.runId) current.runs.add(item.context.runId);
      grouped.set(tenantId, current);
    }

    return [...grouped.entries()]
      .map(([tenantId, value]) => ({
        tenantId,
        snapshotCount: value.snapshotCount,
        spansCount: value.spansCount,
        pendingApprovalsCount: value.pendingApprovalsCount,
        latestTotalCostUsd: value.latestTotalCostUsd,
        sessionCount: value.sessions.size,
        runCount: value.runs.size,
        latestGeneratedAt: value.latestGeneratedAt,
      }))
      .sort((a, b) => a.tenantId.localeCompare(b.tenantId));
  }

  private recordPolicyExplainTrace(
    mode: "single" | "batch" | "simulate" | "diff" | "drift",
    payload: unknown,
  ): ControlPlanePolicyExplainTrace {
    const trace: ControlPlanePolicyExplainTrace = {
      traceId: `trace-${this.nextExplainTraceId++}`,
      generatedAt: new Date().toISOString(),
      mode,
      payload,
    };
    this.latestExplainTraceId = trace.traceId;
    this.explainTraces.push(trace);
    if (this.explainTraces.length > this.historyLimit) {
      this.explainTraces.shift();
    }
    return trace;
  }

  private opsPolicyExplain(params: URLSearchParams): RoutingDecisionExplanation & { traceId: string } {
    const parsed = this.parsePolicyExplainOptions(params);
    const explanation = explainRoutingTarget(
      this.routingPolicy,
      parsed.provider,
      parsed.model,
      parsed.options,
    );
    const trace = this.recordPolicyExplainTrace("single", {
      input: {
        provider: parsed.provider,
        model: parsed.model,
        options: parsed.options,
      },
      explanation,
    });
    return { ...explanation, traceId: trace.traceId };
  }

  private opsPolicyExplainBatch(params: URLSearchParams): {
    ok: true;
    traceId: string;
    total: number;
    passed: number;
    failed: number;
    results: Array<{
      index: number;
      input: { provider: ProviderType; model: string };
      explanation: RoutingDecisionExplanation;
    }>;
  } {
    const scenarios = this.parsePolicyExplainBatchScenarios(params);
    const response = this.buildPolicyExplainBatchResponse(scenarios);
    const trace = this.recordPolicyExplainTrace("batch", response);
    return { ...response, traceId: trace.traceId };
  }

  private buildPolicyExplainBatchResponse(scenarios: Array<{
    provider: ProviderType;
    model: string;
    options: ResolveRoutingTargetOptions;
  }>): {
    ok: true;
    total: number;
    passed: number;
    failed: number;
    results: Array<{
      index: number;
      input: { provider: ProviderType; model: string };
      explanation: RoutingDecisionExplanation;
    }>;
  } {
    const results = scenarios.map((scenario, index) => ({
      index,
      input: {
        provider: scenario.provider,
        model: scenario.model,
      },
      explanation: explainRoutingTarget(
        this.routingPolicy,
        scenario.provider,
        scenario.model,
        scenario.options,
      ),
    }));
    const passed = results.filter((item) => item.explanation.ok).length;
    return {
      ok: true,
      total: results.length,
      passed,
      failed: results.length - passed,
      results,
    };
  }

  private opsPolicyExplainSimulation(params: URLSearchParams): {
    ok: true;
    traceId: string;
    total: number;
    passed: number;
    failed: number;
    results: Array<{
      index: number;
      input: { provider: ProviderType; model: string };
      explanation: RoutingDecisionExplanation;
    }>;
  } {
    const scenarios = this.parsePolicyExplainBatchScenarios(params);
    const response = this.buildPolicyExplainBatchResponse(scenarios);
    const trace = this.recordPolicyExplainTrace("simulate", response);
    return { ...response, traceId: trace.traceId };
  }

  private opsPolicyExplainDiff(params: URLSearchParams): {
    ok: true;
    traceId: string;
    total: number;
    baselinePassed: number;
    candidatePassed: number;
    changed: number;
    regressions: number;
    results: Array<{
      index: number;
      input: { provider: ProviderType; model: string };
      baseline: RoutingDecisionExplanation;
      candidate: RoutingDecisionExplanation;
      changed: boolean;
    }>;
  } {
    const scenarios = this.parsePolicyExplainBatchScenarios(params);
    const diff = evaluatePolicyDiff(this.routingPolicy, scenarios, undefined);
    const response: {
      ok: true;
      total: number;
      baselinePassed: number;
      candidatePassed: number;
      changed: number;
      regressions: number;
      results: Array<{
        index: number;
        input: { provider: ProviderType; model: string };
        baseline: RoutingDecisionExplanation;
        candidate: RoutingDecisionExplanation;
        changed: boolean;
      }>;
    } = {
      ok: true,
      total: diff.total,
      baselinePassed: diff.baselinePassed,
      candidatePassed: diff.candidatePassed,
      changed: diff.changed,
      regressions: diff.regressions,
      results: diff.results,
    };
    const trace = this.recordPolicyExplainTrace("diff", response);
    return { ...response, traceId: trace.traceId };
  }

  private opsPolicyDriftScheduleSet(params: URLSearchParams): {
    ok: true;
    schedule: {
      enabled: boolean;
      intervalMs: number;
      window: ControlPlanePolicyDriftWindow;
      updatedAt: string;
      lastRunAt?: string;
      baselineVersionId?: string;
      candidateVersionId?: string;
      hasBaselinePolicy: boolean;
      hasCandidatePolicy: boolean;
      guardrails: PolicyRolloutGuardrails;
    };
  } {
    const scenariosRaw = params.get("scenarios");
    if (!scenariosRaw) {
      throw new ValidationError("Missing scenarios query parameter", "scenarios");
    }
    void this.parsePolicyExplainBatchScenarios(params);
    const intervalMs = this.parseOptionalNumber(params.get("intervalMs"), "intervalMs") ?? 60_000;
    if (intervalMs <= 0) {
      throw new ValidationError("intervalMs must be > 0", "intervalMs");
    }
    const now = new Date().toISOString();
    this.policyDriftScheduleConfig = {
      enabled: true,
      intervalMs,
      window: this.parsePolicyDriftWindow(params.get("window")),
      scenariosRaw,
      baselinePolicyRaw: params.get("baselinePolicy") ?? undefined,
      candidatePolicyRaw: params.get("candidatePolicy") ?? undefined,
      baselineVersionId: params.get("baselineVersion") ?? undefined,
      candidateVersionId: params.get("candidateVersion") ?? undefined,
      guardrails: this.parsePolicyDriftGuardrails(params),
      updatedAt: now,
      lastRunAt: this.policyDriftScheduleConfig?.lastRunAt,
    };
    return {
      ok: true,
      schedule: {
        enabled: this.policyDriftScheduleConfig.enabled,
        intervalMs: this.policyDriftScheduleConfig.intervalMs,
        window: this.policyDriftScheduleConfig.window,
        updatedAt: this.policyDriftScheduleConfig.updatedAt,
        lastRunAt: this.policyDriftScheduleConfig.lastRunAt,
        baselineVersionId: this.policyDriftScheduleConfig.baselineVersionId,
        candidateVersionId: this.policyDriftScheduleConfig.candidateVersionId,
        hasBaselinePolicy: !!this.policyDriftScheduleConfig.baselinePolicyRaw,
        hasCandidatePolicy: !!this.policyDriftScheduleConfig.candidatePolicyRaw,
        guardrails: this.policyDriftScheduleConfig.guardrails,
      },
    };
  }

  private opsPolicyDriftSchedule(): {
    ok: true;
    schedule: null | {
      enabled: boolean;
      intervalMs: number;
      window: ControlPlanePolicyDriftWindow;
      updatedAt: string;
      lastRunAt?: string;
      baselineVersionId?: string;
      candidateVersionId?: string;
      hasBaselinePolicy: boolean;
      hasCandidatePolicy: boolean;
      guardrails: PolicyRolloutGuardrails;
    };
    runs: ControlPlanePolicyDriftScheduleRun[];
  } {
    if (!this.policyDriftScheduleConfig) {
      return { ok: true, schedule: null, runs: [...this.policyDriftRuns] };
    }
    return {
      ok: true,
      schedule: {
        enabled: this.policyDriftScheduleConfig.enabled,
        intervalMs: this.policyDriftScheduleConfig.intervalMs,
        window: this.policyDriftScheduleConfig.window,
        updatedAt: this.policyDriftScheduleConfig.updatedAt,
        lastRunAt: this.policyDriftScheduleConfig.lastRunAt,
        baselineVersionId: this.policyDriftScheduleConfig.baselineVersionId,
        candidateVersionId: this.policyDriftScheduleConfig.candidateVersionId,
        hasBaselinePolicy: !!this.policyDriftScheduleConfig.baselinePolicyRaw,
        hasCandidatePolicy: !!this.policyDriftScheduleConfig.candidatePolicyRaw,
        guardrails: this.policyDriftScheduleConfig.guardrails,
      },
      runs: [...this.policyDriftRuns],
    };
  }

  private opsPolicyDriftScheduleRun(params: URLSearchParams): ControlPlanePolicyDriftScheduleRun {
    const runParams = new URLSearchParams(params);
    if (!runParams.get("scenarios")) {
      if (!this.policyDriftScheduleConfig) {
        throw new ValidationError("Missing scenarios query parameter", "scenarios");
      }
      runParams.set("scenarios", this.policyDriftScheduleConfig.scenariosRaw);
      if (!runParams.get("window")) runParams.set("window", this.policyDriftScheduleConfig.window);
      if (!runParams.get("baselineVersion") && this.policyDriftScheduleConfig.baselineVersionId) {
        runParams.set("baselineVersion", this.policyDriftScheduleConfig.baselineVersionId);
      }
      if (!runParams.get("candidateVersion") && this.policyDriftScheduleConfig.candidateVersionId) {
        runParams.set("candidateVersion", this.policyDriftScheduleConfig.candidateVersionId);
      }
      if (!runParams.get("baselinePolicy") && this.policyDriftScheduleConfig.baselinePolicyRaw) {
        runParams.set("baselinePolicy", this.policyDriftScheduleConfig.baselinePolicyRaw);
      }
      if (!runParams.get("candidatePolicy") && this.policyDriftScheduleConfig.candidatePolicyRaw) {
        runParams.set("candidatePolicy", this.policyDriftScheduleConfig.candidatePolicyRaw);
      }
      if (!runParams.get("maxChanged") && this.policyDriftScheduleConfig.guardrails.maxChanged !== undefined) {
        runParams.set("maxChanged", String(this.policyDriftScheduleConfig.guardrails.maxChanged));
      }
      if (!runParams.get("maxRegressions") && this.policyDriftScheduleConfig.guardrails.maxRegressions !== undefined) {
        runParams.set("maxRegressions", String(this.policyDriftScheduleConfig.guardrails.maxRegressions));
      }
      if (
        !runParams.get("minCandidatePassRate")
        && this.policyDriftScheduleConfig.guardrails.minCandidatePassRate !== undefined
      ) {
        runParams.set("minCandidatePassRate", String(this.policyDriftScheduleConfig.guardrails.minCandidatePassRate));
      }
    }

    const drift = this.opsPolicyDrift(runParams);
    const run: ControlPlanePolicyDriftScheduleRun = {
      ...drift,
      runId: `drift-run-${this.nextPolicyDriftRunId++}`,
    };
    this.policyDriftRuns.push(run);
    if (this.policyDriftRuns.length > this.historyLimit) {
      this.policyDriftRuns.shift();
    }
    if (this.policyDriftScheduleConfig) {
      this.policyDriftScheduleConfig.lastRunAt = run.generatedAt;
      this.policyDriftScheduleConfig.updatedAt = new Date().toISOString();
    }
    return run;
  }

  private opsPolicyDrift(params: URLSearchParams): ControlPlanePolicyDriftAlert & { traceId: string } {
    const scenarios = this.parsePolicyExplainBatchScenarios(params);
    const window = this.parsePolicyDriftWindow(params.get("window"));
    const baselineVersionId = params.get("baselineVersion");
    const candidateVersionId = params.get("candidateVersion");

    const baselineFromVersion = baselineVersionId
      ? this.cloneRoutingPolicy(this.findLifecycleVersion(baselineVersionId).policy)
      : this.activePolicyVersionId
        ? this.cloneRoutingPolicy(this.findLifecycleVersion(this.activePolicyVersionId).policy)
        : undefined;
    const candidateFromVersion = candidateVersionId
      ? this.cloneRoutingPolicy(this.findLifecycleVersion(candidateVersionId).policy)
      : undefined;

    const baselinePolicy = this.parseOptionalPolicyFromQuery(params, "baselinePolicy") ?? baselineFromVersion;
    const candidatePolicy = this.parseOptionalPolicyFromQuery(params, "candidatePolicy")
      ?? candidateFromVersion
      ?? this.routingPolicy;

    const diff = evaluatePolicyDiff(candidatePolicy, scenarios, baselinePolicy);
    const guardrails = evaluatePolicyRolloutGuardrails(diff, this.parsePolicyDriftGuardrails(params));
    const response: ControlPlanePolicyDriftAlert = {
      ok: guardrails.ok,
      alert: !guardrails.ok,
      generatedAt: new Date().toISOString(),
      window,
      baselineVersionId: baselineVersionId ?? this.activePolicyVersionId ?? null,
      candidateVersionId: candidateVersionId ?? null,
      diff,
      guardrails,
      sinksTriggered: !guardrails.ok ? [...this.policyDriftSinks] : [],
    };
    if (response.alert) {
      for (const hook of this.policyDriftAlertHooks) {
        hook(response);
      }
    }
    const trace = this.recordPolicyExplainTrace("drift", response);
    return { ...response, traceId: trace.traceId };
  }

  private opsPolicyExplainTraces(params: URLSearchParams): {
    total: number;
    traces: ControlPlanePolicyExplainTrace[];
  } {
    const traceId = params.get("traceId");
    const traces = traceId
      ? this.explainTraces.filter((item) => item.traceId === traceId)
      : this.explainTraces;
    return {
      total: traces.length,
      traces,
    };
  }

  private emitStreamBatch(
    res: import("node:http").ServerResponse,
    channels: ControlPlaneStreamChannel[],
    filters: ControlPlaneContext,
  ): void {
    const snapshot = this.captureSnapshot();
    for (const channel of channels) {
      this.writeSseEvent(res, this.buildStreamEvent(channel, filters, snapshot));
    }
  }

  private replayStreamEvents(
    res: import("node:http").ServerResponse,
    channels: ControlPlaneStreamChannel[],
    filters: ControlPlaneContext,
    lastEventId: number | null,
  ): number {
    if (lastEventId === null) return 0;
    let replayed = 0;
    for (const event of this.streamEvents) {
      if (event.id <= lastEventId) continue;
      if (!channels.includes(event.event)) continue;
      if (!this.matchesContext(event.context, filters)) continue;
      this.writeSseEvent(res, event);
      replayed += 1;
    }
    return replayed;
  }

  private assertChannelAllowed(channel: ControlPlaneStreamChannel): void {
    const roles = (this.authClaims?.roles ?? []).map((role) => role.toLowerCase());
    if (roles.length === 0) return;
    if (roles.includes("admin") || roles.includes("operator")) return;
    if ((channel === "snapshot" || channel === "timeline") && (roles.includes("viewer") || roles.includes("reader"))) {
      return;
    }
    throw new ControlPlaneForbiddenError(`Forbidden stream channel "${channel}"`);
  }

  private applyAuthClaims(filters: ControlPlaneContext): ControlPlaneContext {
    if (!this.authClaims) return filters;
    const resolved = { ...filters };

    if (this.authClaims.tenantId) {
      if (resolved.tenantId && resolved.tenantId !== this.authClaims.tenantId) {
        throw new ControlPlaneForbiddenError("Forbidden tenant scope");
      }
      resolved.tenantId ??= this.authClaims.tenantId;
    }

    const allowedSessions = this.authClaims.allowedSessionIds ?? [];
    if (resolved.sessionId && allowedSessions.length > 0 && !allowedSessions.includes(resolved.sessionId)) {
      throw new ControlPlaneForbiddenError("Forbidden session scope");
    }
    if (!resolved.sessionId && allowedSessions.length === 1) {
      resolved.sessionId = allowedSessions[0];
    }

    const allowedRuns = this.authClaims.allowedRunIds ?? [];
    if (resolved.runId && allowedRuns.length > 0 && !allowedRuns.includes(resolved.runId)) {
      throw new ControlPlaneForbiddenError("Forbidden run scope");
    }
    if (!resolved.runId && allowedRuns.length === 1) {
      resolved.runId = allowedRuns[0];
    }

    return resolved;
  }

  private assertContextAllowed(context: ControlPlaneContext): void {
    if (!this.authClaims) return;
    void this.applyAuthClaims(context);
  }

  private filterHistory(filters?: ControlPlaneContext): ControlPlaneSnapshot[] {
    if (!filters || (!filters.tenantId && !filters.sessionId && !filters.runId)) {
      return [...this.history];
    }
    return this.history.filter((item) => this.matchesContext(item.context, filters));
  }

  private matchesContext(context: ControlPlaneContext, filters: ControlPlaneContext): boolean {
    if (filters.tenantId && context.tenantId !== filters.tenantId) return false;
    if (filters.sessionId && context.sessionId !== filters.sessionId) return false;
    if (filters.runId && context.runId !== filters.runId) return false;
    return true;
  }

  private spanLabel(span: unknown, index: number): string {
    if (span && typeof span === "object") {
      const rec = span as Record<string, unknown>;
      if (typeof rec.name === "string") return rec.name;
      if (typeof rec.span_name === "string") return rec.span_name;
    }
    return `span-${index + 1}`;
  }

  private isAuthorized(req: IncomingMessage, parsed: URL): boolean {
    if (!this.authToken) return true;
    const authHeader = req.headers.authorization;
    const bearer = typeof authHeader === "string" && authHeader === `Bearer ${this.authToken}`;
    const tokenHeader = req.headers["x-gauss-token"];
    const xToken = typeof tokenHeader === "string" && tokenHeader === this.authToken;
    const queryToken = parsed.searchParams.get("token") === this.authToken;
    return bearer || xToken || queryToken;
  }

  private renderDashboardHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gauss Control Plane</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 24px; background: #0b1020; color: #f5f7ff; }
    h1 { margin-top: 0; }
    .muted { color: #a9b4d0; margin-bottom: 12px; }
    pre { background: #111935; border: 1px solid #25315f; padding: 16px; border-radius: 8px; overflow: auto; max-height: 70vh; }
  </style>
</head>
<body>
  <h1>Gauss Control Plane</h1>
  <div class="muted">Live snapshot refreshes every 2s • filter: <code>?section=metrics</code> • auth via <code>?token=...</code></div>
  <pre id="out">loading...</pre>
  <script>
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const section = params.get('section');
    const qs = new URLSearchParams();
    if (token) qs.set('token', token);
    if (section) qs.set('section', section);
    async function refresh() {
      const target = '/api/snapshot' + (qs.toString() ? ('?' + qs.toString()) : '');
      const r = await fetch(target);
      if (!r.ok) {
        document.getElementById('out').textContent = 'HTTP ' + r.status + ': ' + await r.text();
        return;
      }
      const j = await r.json();
      document.getElementById('out').textContent = JSON.stringify(j, null, 2);
    }
    setInterval(refresh, 2000);
    refresh();
  </script>
</body>
</html>`;
  }

  private renderHostedOpsHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gauss Hosted Ops Console</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 20px; background: #0b1020; color: #f5f7ff; }
    .row { margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, button { background: #111935; color: #f5f7ff; border: 1px solid #25315f; border-radius: 6px; padding: 8px; }
    pre { background: #111935; border: 1px solid #25315f; padding: 12px; border-radius: 8px; max-height: 60vh; overflow: auto; }
    .muted { color: #a9b4d0; }
  </style>
</head>
<body>
  <h1>Gauss Hosted Ops Console</h1>
  <div class="muted">Live stream viewer with multiplex channels + replay cursor support.</div>
  <div class="row"><a href="/ops/tenants" style="color:#9cc3ff">Open tenant dashboard →</a></div>
  <div class="row">
    <label>Token <input id="token" placeholder="optional" /></label>
    <label>Last Event ID <input id="lastEventId" placeholder="optional" /></label>
    <button id="connect">Connect</button>
  </div>
  <div class="row">
    <label><input type="checkbox" class="ch" value="snapshot" checked /> snapshot</label>
    <label><input type="checkbox" class="ch" value="timeline" checked /> timeline</label>
    <label><input type="checkbox" class="ch" value="dag" /> dag</label>
  </div>
  <pre id="out">idle</pre>
  <script>
    let source;
    const out = document.getElementById('out');
    function selectedChannels() {
      return [...document.querySelectorAll('.ch:checked')].map((node) => node.value);
    }
    function append(message) {
      out.textContent = message + "\\n" + out.textContent;
    }
    document.getElementById('connect').addEventListener('click', () => {
      if (source) source.close();
      const token = document.getElementById('token').value.trim();
      const lastEventId = document.getElementById('lastEventId').value.trim();
      const channels = selectedChannels();
      const qs = new URLSearchParams();
      if (channels.length > 0) qs.set('channels', channels.join(','));
      if (token) qs.set('token', token);
      if (lastEventId) qs.set('lastEventId', lastEventId);
      source = new EventSource('/api/stream?' + qs.toString());
      source.onmessage = (event) => append(event.data);
      source.onerror = () => append('stream disconnected');
      append('stream connected');
    });
    fetch('/api/ops/capabilities')
      .then((r) => r.json())
      .then((j) => append('capabilities: ' + JSON.stringify(j)));
  </script>
</body>
</html>`;
  }

  private renderHostedTenantOpsHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gauss Hosted Tenant Ops</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 20px; background: #0b1020; color: #f5f7ff; }
    .row { margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, button { background: #111935; color: #f5f7ff; border: 1px solid #25315f; border-radius: 6px; padding: 8px; }
    pre { background: #111935; border: 1px solid #25315f; padding: 12px; border-radius: 8px; max-height: 60vh; overflow: auto; }
    a { color: #9cc3ff; }
    .muted { color: #a9b4d0; }
  </style>
</head>
<body>
  <h1>Gauss Hosted Tenant Ops</h1>
  <div class="muted">Tenant-level operational metrics powered by <code>/api/ops/tenants</code>.</div>
  <div class="row"><a href="/ops">← Back to stream console</a></div>
  <div class="row">
    <label>Token <input id="token" placeholder="optional" /></label>
    <label>Tenant <input id="tenant" placeholder="optional filter" /></label>
    <button id="refresh">Refresh</button>
  </div>
  <pre id="out">loading...</pre>
  <script>
    const out = document.getElementById('out');
    async function refresh() {
      const token = document.getElementById('token').value.trim();
      const tenant = document.getElementById('tenant').value.trim();
      const qs = new URLSearchParams();
      if (token) qs.set('token', token);
      if (tenant) qs.set('tenant', tenant);
      const target = '/api/ops/tenants' + (qs.toString() ? ('?' + qs.toString()) : '');
      const r = await fetch(target);
      if (!r.ok) {
        out.textContent = 'HTTP ' + r.status + ': ' + await r.text();
        return;
      }
      const j = await r.json();
      out.textContent = JSON.stringify(j, null, 2);
    }
    document.getElementById('refresh').addEventListener('click', refresh);
    refresh();
  </script>
</body>
</html>`;
  }
}
