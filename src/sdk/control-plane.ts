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
import type { Disposable } from "./types.js";
import type { Telemetry } from "./telemetry.js";
import type { ApprovalManager } from "./approval.js";
import { estimateCost } from "./tokens.js";

class ControlPlaneForbiddenError extends Error {}

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
  hostedDashboardPath: string;
}

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

export class ControlPlane implements Disposable {
  private readonly telemetry?: Pick<Telemetry, "exportSpans" | "exportMetrics">;
  private readonly approvals?: Pick<ApprovalManager, "listPending">;
  private model: string;
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
  private server: Server | null = null;

  constructor(options: ControlPlaneOptions = {}) {
    this.telemetry = options.telemetry;
    this.approvals = options.approvals;
    this.model = options.model ?? "gpt-5.2";
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
      hostedDashboardPath: "/ops",
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
}
