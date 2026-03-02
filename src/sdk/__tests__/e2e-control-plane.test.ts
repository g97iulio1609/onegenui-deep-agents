import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, readFileSync, rmSync } from "node:fs";

import { ControlPlane } from "../control-plane.js";
import { clearPricing, setPricing } from "../tokens.js";

describe("ControlPlane E2E", () => {
  it("serves secured operational endpoints end-to-end", async () => {
    const persistPath = join(tmpdir(), `gauss-cp-e2e-${Date.now()}.jsonl`);
    setPricing("cp-e2e-model", { inputPerToken: 0.001, outputPerToken: 0.001 });

    const cp = new ControlPlane({
      model: "cp-e2e-model",
      authToken: "e2e-token",
      persistPath,
      telemetry: {
        exportSpans: () => [{ name: "collect" }, { name: "verify" }],
        exportMetrics: () => ({ totalSpans: 2 }),
      },
      approvals: {
        listPending: () => [{ id: "approval-1", tool: "delete" }],
      },
    });

    cp.setCostUsage({ inputTokens: 10, outputTokens: 5 });
    const { url } = await cp.startServer("127.0.0.1", 0);

    const unauthorized = await fetch(`${url}/api/snapshot`);
    expect(unauthorized.status).toBe(401);

    const snapshot = await fetch(`${url}/api/snapshot?token=e2e-token`);
    expect(snapshot.status).toBe(200);

    const timeline = await fetch(`${url}/api/timeline?token=e2e-token`);
    const timelineBody = await timeline.json() as Array<{ spanCount: number; pendingApprovalsCount: number }>;
    expect(timelineBody[timelineBody.length - 1].spanCount).toBe(2);
    expect(timelineBody[timelineBody.length - 1].pendingApprovalsCount).toBe(1);

    const dag = await fetch(`${url}/api/dag?token=e2e-token`);
    const dagBody = await dag.json() as { nodes: Array<unknown>; edges: Array<unknown> };
    expect(dagBody.nodes.length).toBe(2);
    expect(dagBody.edges.length).toBe(1);

    await cp.stopServer();
    clearPricing();

    expect(existsSync(persistPath)).toBe(true);
    const lines = readFileSync(persistPath, "utf8").trim().split("\n");
    expect(lines.length).toBeGreaterThan(0);
    rmSync(persistPath, { force: true });
  });

  it("streams snapshot events in simple hosted flow", async () => {
    const cp = new ControlPlane({
      telemetry: {
        exportSpans: () => [{ name: "simple" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });

    cp.withContext({ tenantId: "t-simple", sessionId: "s-simple", runId: "r-simple" }).snapshot();
    const { url } = await cp.startServer("127.0.0.1", 0);
    const stream = await fetch(`${url}/api/stream?channel=snapshot&once=1`);
    expect(stream.status).toBe(200);
    const body = await stream.text();
    expect(body).toContain("event: snapshot");
    const dataLine = body.split("\n").find((line) => line.startsWith("data: "));
    const event = JSON.parse((dataLine ?? "").slice(6)) as { event: string; payload: { context: { tenantId?: string } } };
    expect(event.event).toBe("snapshot");
    expect(event.payload.context.tenantId).toBe("t-simple");
    await cp.stopServer();
  });

  it("streams scoped timeline events and rejects forbidden claims scopes", async () => {
    const cp = new ControlPlane({
      authToken: "stream-token",
      authClaims: {
        tenantId: "tenant-a",
        allowedSessionIds: ["session-a"],
      },
      telemetry: {
        exportSpans: () => [{ name: "collect" }],
        exportMetrics: () => ({ totalSpans: 1 }),
      },
      approvals: {
        listPending: () => [],
      },
    });

    cp.withContext({ tenantId: "tenant-a", sessionId: "session-a", runId: "run-a" }).snapshot();
    const { url } = await cp.startServer("127.0.0.1", 0);

    const allowed = await fetch(`${url}/api/stream?token=stream-token&channel=timeline&once=1`);
    expect(allowed.status).toBe(200);
    const allowedBody = await allowed.text();
    const dataLine = allowedBody.split("\n").find((line) => line.startsWith("data: "));
    const event = JSON.parse((dataLine ?? "").slice(6)) as { payload: Array<{ spanCount: number }> };
    expect(Array.isArray(event.payload)).toBe(true);

    const forbidden = await fetch(`${url}/api/stream?token=stream-token&channel=timeline&tenant=tenant-b&once=1`);
    expect(forbidden.status).toBe(403);

    await cp.stopServer();
  });
});
