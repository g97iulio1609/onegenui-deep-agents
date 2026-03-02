import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ControlPlane } from "../control-plane.js";
import { clearPricing, setPricing } from "../tokens.js";

describe("ControlPlane", () => {
  it("builds snapshots from telemetry and approvals", () => {
    const cp = new ControlPlane({
      telemetry: {
        exportSpans: () => [{ name: "agent.run", duration_ms: 12 }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [{ id: "req-1", tool: "delete_user" }],
      },
    });

    const snap = cp.snapshot();
    expect(Array.isArray(snap.spans)).toBe(true);
    expect((snap.spans as Array<{ name: string }>)[0].name).toBe("agent.run");
    expect((snap.metrics as { totalSpans: number }).totalSpans).toBe(1);
    expect((snap.pendingApprovals as Array<{ id: string }>)[0].id).toBe("req-1");
  });

  it("computes latest cost from usage", () => {
    setPricing("cp-test-model", {
      inputPerToken: 0.001,
      outputPerToken: 0.002,
    });

    const cp = new ControlPlane({ model: "cp-test-model" });
    cp.setCostUsage({ inputTokens: 10, outputTokens: 5 });
    const snap = cp.snapshot();
    expect(snap.latestCost?.totalCostUsd).toBeCloseTo(0.02, 6);

    clearPricing();
  });

  it("serves dashboard and snapshot endpoint", async () => {
    const cp = new ControlPlane();
    const { url } = await cp.startServer("127.0.0.1", 0);

    const apiRes = await fetch(`${url}/api/snapshot`);
    expect(apiRes.status).toBe(200);
    const body = await apiRes.json() as { generatedAt: string };
    expect(typeof body.generatedAt).toBe("string");

    const htmlRes = await fetch(`${url}/`);
    const html = await htmlRes.text();
    expect(html).toContain("Gauss Control Plane");

    await cp.stopServer();
  });

  it("exposes hosted ops capabilities, health, and dashboard", async () => {
    const cp = new ControlPlane({
      telemetry: {
        exportSpans: () => [{ name: "agent.run" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
      routingPolicy: {
        fallbackOrder: ["openai"],
        allowedHoursUtc: [9, 10, 11],
      },
    });
    cp.registerPolicyDriftSink("webhook://ops-audit");
    cp.withContext({ tenantId: "t-1", sessionId: "s-1", runId: "r-1" }).snapshot();
    cp.withContext({ tenantId: "t-2", sessionId: "s-2", runId: "r-2" }).snapshot();
    const { url } = await cp.startServer("127.0.0.1", 0);

    const capsRes = await fetch(`${url}/api/ops/capabilities`);
    expect(capsRes.status).toBe(200);
    const caps = await capsRes.json() as {
      supportsMultiplex: boolean;
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
    };
    expect(caps.supportsMultiplex).toBe(true);
    expect(caps.supportsOpsSummary).toBe(true);
    expect(caps.supportsOpsTenants).toBe(true);
    expect(caps.supportsPolicyExplain).toBe(true);
    expect(caps.supportsPolicyExplainBatch).toBe(true);
    expect(caps.supportsPolicyExplainTraces).toBe(true);
    expect(caps.supportsPolicyExplainDiff).toBe(true);
    expect(caps.supportsPolicyLifecycle).toBe(true);
    expect(caps.supportsPolicyLifecycleRbac).toBe(true);
    expect(caps.supportsPolicyDriftMonitoring).toBe(true);
    expect(caps.supportsPolicyDriftScheduler).toBe(true);
    expect(caps.supportsPolicyDriftWindows).toBe(true);
    expect(caps.supportsPolicyDriftAlertSinks).toBe(true);
    expect(caps.hostedDashboardPath).toBe("/ops");
    expect(caps.hostedTenantDashboardPath).toBe("/ops/tenants");
    expect(caps.policyExplainPath).toBe("/api/ops/policy/explain");
    expect(caps.policyExplainBatchPath).toBe("/api/ops/policy/explain/batch");
    expect(caps.policyExplainSimulatePath).toBe("/api/ops/policy/explain/simulate");
    expect(caps.policyExplainTracePath).toBe("/api/ops/policy/explain/traces");
    expect(caps.policyExplainDiffPath).toBe("/api/ops/policy/explain/diff");
    expect(caps.policyLifecycleBasePath).toBe("/api/ops/policy/lifecycle");
    expect(caps.policyLifecycleRoleParam).toBe("role");
    expect(caps.policyLifecycleAuditFields).toContain("approvedByRole");
    expect(caps.policyDriftPath).toBe("/api/ops/policy/drift");
    expect(caps.policyDriftSchedulePath).toBe("/api/ops/policy/drift/schedule");
    expect(caps.policyDriftScheduleRunPath).toBe("/api/ops/policy/drift/schedule/run");

    const healthRes = await fetch(`${url}/api/ops/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json() as { status: string; historySize: number };
    expect(health.status).toBe("ok");
    expect(health.historySize).toBeGreaterThan(0);

    const summaryRes = await fetch(`${url}/api/ops/summary`);
    expect(summaryRes.status).toBe(200);
    const summary = await summaryRes.json() as { status: string; historySize: number; spansCount: number };
    expect(summary.status).toBe("ok");
    expect(summary.historySize).toBeGreaterThan(0);
    expect(summary.spansCount).toBeGreaterThanOrEqual(1);

    const tenantsRes = await fetch(`${url}/api/ops/tenants`);
    expect(tenantsRes.status).toBe(200);
    const tenants = await tenantsRes.json() as Array<{ tenantId: string; snapshotCount: number }>;
    expect(tenants.length).toBeGreaterThanOrEqual(2);
    expect(tenants.some((item) => item.tenantId === "t-1")).toBe(true);
    expect(tenants.some((item) => item.tenantId === "t-2")).toBe(true);

    const explainRes = await fetch(`${url}/api/ops/policy/explain?provider=openai&model=gpt-5.2&hour=10`);
    expect(explainRes.status).toBe(200);
    const explain = await explainRes.json() as {
      ok: boolean;
      traceId: string;
      decision?: { provider: string; model: string; selectedBy: string };
      checks: Array<{ check: string; status: string }>;
    };
    expect(explain.ok).toBe(true);
    expect(explain.traceId.startsWith("trace-")).toBe(true);
    expect(explain.decision?.provider).toBe("openai");
    expect(explain.decision?.selectedBy).toBe("direct");
    expect(explain.checks.some((item) => item.check === "selection" && item.status === "passed")).toBe(true);

    const scenarios = encodeURIComponent(JSON.stringify([
      { provider: "openai", model: "gpt-5.2", hour: 10 },
      { provider: "openai", model: "gpt-5.2", hour: 22 },
    ]));
    const batchRes = await fetch(`${url}/api/ops/policy/explain/batch?scenarios=${scenarios}`);
    expect(batchRes.status).toBe(200);
    const batch = await batchRes.json() as {
      ok: boolean;
      traceId: string;
      total: number;
      passed: number;
      failed: number;
      results: Array<{ explanation: { ok: boolean } }>;
    };
    expect(batch.ok).toBe(true);
    expect(batch.traceId.startsWith("trace-")).toBe(true);
    expect(batch.total).toBe(2);
    expect(batch.passed).toBe(1);
    expect(batch.failed).toBe(1);
    expect(batch.results[0]?.explanation.ok).toBe(true);
    expect(batch.results[1]?.explanation.ok).toBe(false);

    const simulateRes = await fetch(`${url}/api/ops/policy/explain/simulate?scenarios=${scenarios}`);
    expect(simulateRes.status).toBe(200);
    const simulation = await simulateRes.json() as { traceId: string; total: number; passed: number; failed: number };
    expect(simulation.traceId.startsWith("trace-")).toBe(true);
    expect(simulation.total).toBe(2);
    expect(simulation.passed).toBe(1);
    expect(simulation.failed).toBe(1);

    const diffRes = await fetch(`${url}/api/ops/policy/explain/diff?scenarios=${scenarios}`);
    expect(diffRes.status).toBe(200);
    const diff = await diffRes.json() as {
      traceId: string;
      total: number;
      baselinePassed: number;
      candidatePassed: number;
      changed: number;
      regressions: number;
    };
    expect(diff.traceId.startsWith("trace-")).toBe(true);
    expect(diff.total).toBe(2);
    expect(diff.baselinePassed).toBe(2);
    expect(diff.candidatePassed).toBe(1);
    expect(diff.changed).toBe(1);
    expect(diff.regressions).toBe(1);

    const tracesRes = await fetch(`${url}/api/ops/policy/explain/traces`);
    expect(tracesRes.status).toBe(200);
    const traces = await tracesRes.json() as {
      total: number;
      traces: Array<{ traceId: string; mode: string }>;
    };
    expect(traces.total).toBeGreaterThanOrEqual(3);
    expect(traces.traces.some((item) => item.mode === "single")).toBe(true);
    expect(traces.traces.some((item) => item.mode === "batch")).toBe(true);
    expect(traces.traces.some((item) => item.mode === "simulate")).toBe(true);
    expect(traces.traces.some((item) => item.mode === "diff")).toBe(true);

    const lifecyclePolicy = encodeURIComponent(JSON.stringify({
      allowedHoursUtc: [10],
      maxTotalCostUsd: 0.2,
      governance: { rules: [{ type: "require_tag", tag: "rollout" }] },
    }));
    const draftRes = await fetch(`${url}/api/ops/policy/lifecycle/draft?policy=${lifecyclePolicy}`);
    expect(draftRes.status).toBe(200);
    const draft = await draftRes.json() as { ok: boolean; version: { versionId: string; status: string } };
    expect(draft.ok).toBe(true);
    expect(draft.version.status).toBe("draft");

    const lifecycleScenarios = encodeURIComponent(JSON.stringify([
      { provider: "openai", model: "gpt-5.2", hour: 10, tags: "rollout" },
    ]));
    const validateRes = await fetch(
      `${url}/api/ops/policy/lifecycle/validate?version=${draft.version.versionId}&scenarios=${lifecycleScenarios}`,
    );
    expect(validateRes.status).toBe(200);
    const validated = await validateRes.json() as { ok: boolean; version: { status: string } };
    expect(validated.ok).toBe(true);
    expect(validated.version.status).toBe("validated");

    const approveRes = await fetch(`${url}/api/ops/policy/lifecycle/approve?version=${draft.version.versionId}`);
    expect(approveRes.status).toBe(200);
    const approved = await approveRes.json() as { ok: boolean; version: { status: string } };
    expect(approved.ok).toBe(true);
    expect(approved.version.status).toBe("approved");

    const promoteRes = await fetch(`${url}/api/ops/policy/lifecycle/promote?version=${draft.version.versionId}`);
    expect(promoteRes.status).toBe(200);
    const promoted = await promoteRes.json() as { ok: boolean; activeVersionId: string | null; version: { status: string } };
    expect(promoted.ok).toBe(true);
    expect(promoted.activeVersionId).toBe(draft.version.versionId);
    expect(promoted.version.status).toBe("promoted");

    const versionsRes = await fetch(`${url}/api/ops/policy/lifecycle/versions`);
    expect(versionsRes.status).toBe(200);
    const versions = await versionsRes.json() as { ok: boolean; activeVersionId: string | null; versions: Array<{ versionId: string }> };
    expect(versions.ok).toBe(true);
    expect(versions.activeVersionId).toBe(draft.version.versionId);
    expect(versions.versions.some((item) => item.versionId === draft.version.versionId)).toBe(true);

    const driftAlerts: Array<{ alert: boolean; diff: { regressions: number } }> = [];
    cp.onPolicyDriftAlert((alert) => driftAlerts.push(alert));
    const driftScenarios = encodeURIComponent(JSON.stringify([
      { provider: "openai", model: "gpt-5.2", hour: 10, tags: "rollout" },
    ]));
    const candidatePolicy = encodeURIComponent(JSON.stringify({
      allowedHoursUtc: [22],
      governance: { rules: [{ type: "require_tag", tag: "rollout" }] },
    }));
    const driftRes = await fetch(
      `${url}/api/ops/policy/drift?scenarios=${driftScenarios}&candidatePolicy=${candidatePolicy}&maxRegressions=0`,
    );
    expect(driftRes.status).toBe(200);
    const drift = await driftRes.json() as {
      ok: boolean;
      alert: boolean;
      traceId: string;
      window: string;
      diff: { regressions: number };
      guardrails: { ok: boolean };
      sinksTriggered: string[];
    };
    expect(drift.traceId.startsWith("trace-")).toBe(true);
    expect(drift.ok).toBe(false);
    expect(drift.alert).toBe(true);
    expect(drift.window).toBe("custom");
    expect(drift.diff.regressions).toBe(1);
    expect(drift.guardrails.ok).toBe(false);
    expect(drift.sinksTriggered).toContain("webhook://ops-audit");
    expect(driftAlerts).toHaveLength(1);
    expect(driftAlerts[0]?.alert).toBe(true);
    expect(driftAlerts[0]?.diff.regressions).toBe(1);

    const scheduleSetRes = await fetch(
      `${url}/api/ops/policy/drift/schedule/set?scenarios=${driftScenarios}&candidatePolicy=${candidatePolicy}&window=last_1h&intervalMs=30000&maxRegressions=0`,
    );
    expect(scheduleSetRes.status).toBe(200);
    const scheduleSet = await scheduleSetRes.json() as {
      ok: boolean;
      schedule: { window: string; intervalMs: number; guardrails: { maxRegressions?: number } };
    };
    expect(scheduleSet.ok).toBe(true);
    expect(scheduleSet.schedule.window).toBe("last_1h");
    expect(scheduleSet.schedule.intervalMs).toBe(30000);
    expect(scheduleSet.schedule.guardrails.maxRegressions).toBe(0);

    const scheduleRunRes = await fetch(`${url}/api/ops/policy/drift/schedule/run`);
    expect(scheduleRunRes.status).toBe(200);
    const scheduleRun = await scheduleRunRes.json() as {
      runId: string;
      traceId: string;
      window: string;
      alert: boolean;
    };
    expect(scheduleRun.runId.startsWith("drift-run-")).toBe(true);
    expect(scheduleRun.traceId.startsWith("trace-")).toBe(true);
    expect(scheduleRun.window).toBe("last_1h");
    expect(scheduleRun.alert).toBe(true);

    const opsRes = await fetch(`${url}/ops`);
    const opsHtml = await opsRes.text();
    expect(opsHtml).toContain("Gauss Hosted Ops Console");

    const tenantOpsRes = await fetch(`${url}/ops/tenants`);
    const tenantOpsHtml = await tenantOpsRes.text();
    expect(tenantOpsHtml).toContain("Gauss Hosted Tenant Ops");

    await cp.stopServer();
  });

  it("supports auth token protection", async () => {
    const cp = new ControlPlane({ authToken: "secret-token" });
    const { url } = await cp.startServer("127.0.0.1", 0);

    const denied = await fetch(`${url}/api/snapshot`);
    expect(denied.status).toBe(401);

    const allowed = await fetch(`${url}/api/snapshot?token=secret-token`);
    expect(allowed.status).toBe(200);

    await cp.stopServer();
  });

  it("enforces lifecycle RBAC roles and includes audit metadata", async () => {
    const cp = new ControlPlane({
      authToken: "claims-token",
      authClaims: {
        roles: ["author"],
      },
    });
    const { url } = await cp.startServer("127.0.0.1", 0);
    const policy = encodeURIComponent(JSON.stringify({}));
    const scenarios = encodeURIComponent(JSON.stringify([{ provider: "openai", model: "gpt-5.2" }]));

    const draftRes = await fetch(
      `${url}/api/ops/policy/lifecycle/draft?token=claims-token&role=author&actor=alice&comment=${encodeURIComponent("draft created")}&policy=${policy}`,
    );
    expect(draftRes.status).toBe(200);
    const draft = await draftRes.json() as {
      version: {
        versionId: string;
        audit?: { draftedByRole?: string; draftedBy?: string; draftComment?: string };
      };
    };
    expect(draft.version.audit?.draftedByRole).toBe("author");
    expect(draft.version.audit?.draftedBy).toBe("alice");

    const validateRes = await fetch(
      `${url}/api/ops/policy/lifecycle/validate?token=claims-token&version=${draft.version.versionId}&role=author&scenarios=${scenarios}`,
    );
    expect(validateRes.status).toBe(200);
    const validated = await validateRes.json() as {
      ok: boolean;
      version: { audit?: { validatedByRole?: string } };
    };
    expect(validated.ok).toBe(true);
    expect(validated.version.audit?.validatedByRole).toBe("author");

    const approveForbidden = await fetch(
      `${url}/api/ops/policy/lifecycle/approve?token=claims-token&version=${draft.version.versionId}&role=author`,
    );
    expect(approveForbidden.status).toBe(403);

    cp.withAuthClaims({ roles: ["reviewer"] });
    const approveRes = await fetch(
      `${url}/api/ops/policy/lifecycle/approve?token=claims-token&version=${draft.version.versionId}&role=reviewer&actor=bob`,
    );
    expect(approveRes.status).toBe(200);
    const approved = await approveRes.json() as {
      ok: boolean;
      version: { audit?: { approvedByRole?: string; approvedBy?: string } };
    };
    expect(approved.ok).toBe(true);
    expect(approved.version.audit?.approvedByRole).toBe("reviewer");
    expect(approved.version.audit?.approvedBy).toBe("bob");

    const promoteForbidden = await fetch(
      `${url}/api/ops/policy/lifecycle/promote?token=claims-token&version=${draft.version.versionId}&role=reviewer`,
    );
    expect(promoteForbidden.status).toBe(403);

    cp.withAuthClaims({ roles: ["promoter"] });
    const promoteRes = await fetch(
      `${url}/api/ops/policy/lifecycle/promote?token=claims-token&version=${draft.version.versionId}&role=promoter&comment=${encodeURIComponent("ready for prod")}`,
    );
    expect(promoteRes.status).toBe(200);
    const promoted = await promoteRes.json() as {
      ok: boolean;
      version: { audit?: { promotedByRole?: string; promotionComment?: string } };
    };
    expect(promoted.ok).toBe(true);
    expect(promoted.version.audit?.promotedByRole).toBe("promoter");
    expect(promoted.version.audit?.promotionComment).toBe("ready for prod");

    await cp.stopServer();
  });

  it("enforces auth claims on query scopes", async () => {
    const cp = new ControlPlane({
      authToken: "claims-token",
      authClaims: {
        tenantId: "t-1",
        allowedSessionIds: ["s-1"],
        allowedRunIds: ["r-1"],
      },
      telemetry: {
        exportSpans: () => [{ name: "s1" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });

    cp.withContext({ tenantId: "t-1", sessionId: "s-1", runId: "r-1" }).snapshot();
    const { url } = await cp.startServer("127.0.0.1", 0);

    const scoped = await fetch(`${url}/api/history?token=claims-token`);
    expect(scoped.status).toBe(200);
    const scopedBody = await scoped.json() as Array<{ context: { tenantId?: string } }>;
    expect(scopedBody.length).toBe(1);
    expect(scopedBody[0].context.tenantId).toBe("t-1");

    const forbidden = await fetch(`${url}/api/history?token=claims-token&tenant=t-2`);
    expect(forbidden.status).toBe(403);

    await cp.stopServer();
  });

  it("supports section filters, history, timeline, dag, and persistence", async () => {
    const persistPath = join(tmpdir(), `gauss-cp-${Date.now()}.jsonl`);
    const cp = new ControlPlane({
      persistPath,
      telemetry: {
        exportSpans: () => [{ name: "s1" }, { name: "s2" }],
        exportMetrics: () => ({ totalSpans: 2 }),
      },
      approvals: {
        listPending: () => [{ id: "req-1" }],
      },
      model: "cp-test-model",
    });
    setPricing("cp-test-model", { inputPerToken: 0.001, outputPerToken: 0.001 });
    cp.setCostUsage({ inputTokens: 2, outputTokens: 3 });

    const { url } = await cp.startServer("127.0.0.1", 0);
    const metricsOnly = await fetch(`${url}/api/snapshot?section=metrics`);
    const metricsBody = await metricsOnly.json() as { metrics: { totalSpans: number } };
    expect(metricsBody.metrics.totalSpans).toBe(2);

    const timelineRes = await fetch(`${url}/api/timeline`);
    const timeline = await timelineRes.json() as Array<{ spanCount: number; pendingApprovalsCount: number }>;
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline[timeline.length - 1].spanCount).toBe(2);
    expect(timeline[timeline.length - 1].pendingApprovalsCount).toBe(1);

    const dagRes = await fetch(`${url}/api/dag`);
    const dag = await dagRes.json() as { nodes: Array<unknown>; edges: Array<unknown> };
    expect(dag.nodes.length).toBe(2);
    expect(dag.edges.length).toBe(1);

    await cp.stopServer();
    clearPricing();
    expect(existsSync(persistPath)).toBe(true);
    const lines = readFileSync(persistPath, "utf8").trim().split("\n");
    expect(lines.length).toBeGreaterThan(0);
    rmSync(persistPath, { force: true });
  });

  it("supports tenant/session filters for history, timeline, and dag", async () => {
    const cp = new ControlPlane({
      telemetry: {
        exportSpans: () => [{ name: "s1" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });

    cp.withContext({ tenantId: "t-1", sessionId: "s-1", runId: "r-1" }).snapshot();
    cp.withContext({ tenantId: "t-2", sessionId: "s-2", runId: "r-2" }).snapshot();

    const { url } = await cp.startServer("127.0.0.1", 0);

    const historyRes = await fetch(`${url}/api/history?tenant=t-1`);
    const history = await historyRes.json() as Array<{ context: { tenantId?: string } }>;
    expect(history.length).toBe(1);
    expect(history[0].context.tenantId).toBe("t-1");

    const timelineRes = await fetch(`${url}/api/timeline?session=s-2`);
    const timeline = await timelineRes.json() as Array<{ spanCount: number }>;
    expect(timeline.length).toBe(1);
    expect(timeline[0].spanCount).toBe(1);

    const dagRes = await fetch(`${url}/api/dag?run=r-1`);
    const dag = await dagRes.json() as { nodes: Array<{ label: string }> };
    expect(dag.nodes.length).toBe(1);
    expect(dag.nodes[0].label).toBe("s1");

    await cp.stopServer();
  });

  it("exposes SSE stream endpoint for timeline/dag updates", async () => {
    const cp = new ControlPlane({
      telemetry: {
        exportSpans: () => [{ name: "s1" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });
    cp.withContext({ tenantId: "t-1", sessionId: "s-1", runId: "r-1" }).snapshot();

    const { url } = await cp.startServer("127.0.0.1", 0);
    const streamRes = await fetch(`${url}/api/stream?channel=timeline&once=1`);
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("content-type")).toContain("text/event-stream");
    const body = await streamRes.text();
    expect(body).toContain("id: ");
    expect(body).toContain("event: timeline");
    const dataLine = body.split("\n").find((line) => line.startsWith("data: "));
    expect(dataLine).toBeDefined();
    const event = JSON.parse((dataLine ?? "").slice(6)) as { event: string; payload: unknown[] };
    expect(event.event).toBe("timeline");
    expect(Array.isArray(event.payload)).toBe(true);

    await cp.stopServer();
  });

  it("supports stream channel multiplex and replay cursor", async () => {
    const cp = new ControlPlane({
      telemetry: {
        exportSpans: () => [{ name: "s1" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });

    const { url } = await cp.startServer("127.0.0.1", 0);
    const first = await fetch(`${url}/api/stream?channel=snapshot&once=1`);
    const firstBody = await first.text();
    const firstIdLine = firstBody.split("\n").find((line) => line.startsWith("id: "));
    expect(firstIdLine).toBeDefined();
    const firstId = Number.parseInt((firstIdLine ?? "id: 0").slice(4), 10);

    const second = await fetch(`${url}/api/stream?channels=snapshot,timeline&once=1`);
    const secondBody = await second.text();
    expect(secondBody).toContain("event: snapshot");
    expect(secondBody).toContain("event: timeline");

    const replay = await fetch(`${url}/api/stream?channel=snapshot&once=1&lastEventId=${firstId}`);
    const replayBody = await replay.text();
    const replayIds = replayBody
      .split("\n")
      .filter((line) => line.startsWith("id: "))
      .map((line) => Number.parseInt(line.slice(4), 10));
    expect(replayIds.every((id) => id > firstId)).toBe(true);

    await cp.stopServer();
  });

  it("enforces stream channel RBAC roles", async () => {
    const cp = new ControlPlane({
      authToken: "claims-token",
      authClaims: {
        roles: ["viewer"],
      },
      telemetry: {
        exportSpans: () => [{ name: "s1" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });

    const { url } = await cp.startServer("127.0.0.1", 0);
    const forbidden = await fetch(`${url}/api/stream?channel=dag&once=1&token=claims-token`);
    expect(forbidden.status).toBe(403);
    const allowed = await fetch(`${url}/api/stream?channel=timeline&once=1&token=claims-token`);
    expect(allowed.status).toBe(200);

    await cp.stopServer();
  });
});
