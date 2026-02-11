import { describe, it, expect, vi } from "vitest";
import { ApprovalManager } from "../agent/approval-manager.js";
import { EventBus } from "../agent/event-bus.js";
import { DEFAULT_APPROVAL_CONFIG } from "../agent/agent-config.js";
import type {
  AgentEvent,
  AgentEventHandler,
  ApprovalConfig,
} from "../types.js";

// =============================================================================
// ApprovalManager
// =============================================================================

describe("ApprovalManager", () => {
  const sessionId = "test-session";

  function create(
    overrides: ApprovalConfig = {},
    handler?: AgentEventHandler,
  ) {
    const config: Required<ApprovalConfig> = {
      ...DEFAULT_APPROVAL_CONFIG,
      ...overrides,
    };
    return new ApprovalManager(config, sessionId, handler);
  }

  // --- shouldApprove ---

  it("shouldApprove returns true for all tools in approve-all mode", () => {
    const mgr = create({ defaultMode: "approve-all" });
    expect(mgr.shouldApprove("anyTool")).toBe(true);
    expect(mgr.shouldApprove("anotherTool")).toBe(true);
  });

  it("shouldApprove returns false for tools in requireApproval list", () => {
    const mgr = create({
      defaultMode: "approve-all",
      requireApproval: ["dangerousTool"],
    });
    expect(mgr.shouldApprove("dangerousTool")).toBe(false);
    expect(mgr.shouldApprove("safeTool")).toBe(true);
  });

  it("shouldApprove returns false for all tools in deny-all mode", () => {
    const mgr = create({ defaultMode: "deny-all" });
    expect(mgr.shouldApprove("anyTool")).toBe(false);
    expect(mgr.shouldApprove("anotherTool")).toBe(false);
  });

  it("shouldApprove returns true for tools in autoApprove list (deny-all mode)", () => {
    const mgr = create({
      defaultMode: "deny-all",
      autoApprove: ["trustedTool"],
    });
    expect(mgr.shouldApprove("trustedTool")).toBe(true);
    expect(mgr.shouldApprove("otherTool")).toBe(false);
  });

  // --- requestApproval ---

  it("requestApproval calls onApprovalRequired callback", async () => {
    const callback = vi.fn().mockResolvedValue(true);
    const mgr = create({ onApprovalRequired: callback });

    const request = {
      toolName: "myTool",
      toolCallId: "call-1",
      args: { key: "value" },
      sessionId,
      stepIndex: 0,
    };

    const result = await mgr.requestApproval(request);
    expect(callback).toHaveBeenCalledWith(request);
    expect(result.approved).toBe(true);
  });

  it("requestApproval emits approval-required and approved events", async () => {
    const handler = vi.fn();
    const mgr = create({ onApprovalRequired: async () => true }, handler);

    await mgr.requestApproval({
      toolName: "myTool",
      toolCallId: "call-1",
      args: {},
      sessionId,
      stepIndex: 0,
    });

    const types = handler.mock.calls.map(
      (c: unknown[]) => (c[0] as AgentEvent).type,
    );
    expect(types).toContain("tool:approval-required");
    expect(types).toContain("tool:approved");
    expect(types).not.toContain("tool:denied");
  });

  it("requestApproval emits denied event when callback returns false", async () => {
    const handler = vi.fn();
    const mgr = create({ onApprovalRequired: async () => false }, handler);

    const result = await mgr.requestApproval({
      toolName: "myTool",
      toolCallId: "call-1",
      args: {},
      sessionId,
      stepIndex: 0,
    });

    expect(result.approved).toBe(false);
    const types = handler.mock.calls.map(
      (c: unknown[]) => (c[0] as AgentEvent).type,
    );
    expect(types).toContain("tool:approval-required");
    expect(types).toContain("tool:denied");
    expect(types).not.toContain("tool:approved");
  });

  // --- checkAndApprove ---

  it("checkAndApprove auto-approves tools not in deny list", async () => {
    const callback = vi.fn().mockResolvedValue(true);
    const mgr = create({
      defaultMode: "approve-all",
      onApprovalRequired: callback,
    });

    const result = await mgr.checkAndApprove("safeTool", "call-1", {}, 0);
    expect(result.approved).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it("checkAndApprove requests approval for tools in deny list", async () => {
    const callback = vi.fn().mockResolvedValue(false);
    const mgr = create({
      defaultMode: "approve-all",
      requireApproval: ["riskyTool"],
      onApprovalRequired: callback,
    });

    const result = await mgr.checkAndApprove("riskyTool", "call-2", { a: 1 }, 3);
    expect(result.approved).toBe(false);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "riskyTool",
        toolCallId: "call-2",
        args: { a: 1 },
        sessionId,
        stepIndex: 3,
      }),
    );
  });
});

// =============================================================================
// EventBus
// =============================================================================

describe("EventBus", () => {
  const sessionId = "bus-session";

  it("on subscribes to events and receives them", () => {
    const bus = new EventBus(sessionId);
    const handler = vi.fn();

    bus.on("step:start", handler);
    bus.emit("step:start", { step: 1 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "step:start",
        data: { step: 1 },
      }),
    );
  });

  it("on returns unsubscribe function that works", () => {
    const bus = new EventBus(sessionId);
    const handler = vi.fn();

    const unsubscribe = bus.on("step:end", handler);
    bus.emit("step:end");
    expect(handler).toHaveBeenCalledOnce();

    unsubscribe();
    bus.emit("step:end");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("wildcard listener receives all events", () => {
    const bus = new EventBus(sessionId);
    const handler = vi.fn();

    bus.on("*", handler);
    bus.emit("step:start");
    bus.emit("tool:call");
    bus.emit("error");

    expect(handler).toHaveBeenCalledTimes(3);
    const types = handler.mock.calls.map(
      (c: unknown[]) => (c[0] as AgentEvent).type,
    );
    expect(types).toEqual(["step:start", "tool:call", "error"]);
  });

  it("off removes specific listener", () => {
    const bus = new EventBus(sessionId);
    const handler = vi.fn();

    bus.on("tool:call", handler);
    bus.emit("tool:call");
    expect(handler).toHaveBeenCalledOnce();

    bus.off("tool:call", handler);
    bus.emit("tool:call");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("removeAllListeners clears all or specific event listeners", () => {
    const bus = new EventBus(sessionId);
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on("step:start", h1);
    bus.on("step:end", h2);

    bus.removeAllListeners("step:start");
    bus.emit("step:start");
    bus.emit("step:end");
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();

    bus.removeAllListeners();
    bus.emit("step:end");
    expect(h2).toHaveBeenCalledOnce();
  });

  it("listenerCount returns correct count", () => {
    const bus = new EventBus(sessionId);

    expect(bus.listenerCount("step:start")).toBe(0);

    bus.on("step:start", vi.fn());
    bus.on("step:start", vi.fn());
    bus.on("step:end", vi.fn());

    expect(bus.listenerCount("step:start")).toBe(2);
    expect(bus.listenerCount("step:end")).toBe(1);
  });

  it("emit auto-fills timestamp and sessionId", () => {
    const bus = new EventBus(sessionId);
    const handler = vi.fn();

    bus.on("agent:start", handler);
    const before = Date.now();
    bus.emit("agent:start", { info: "go" });
    const after = Date.now();

    const event = handler.mock.calls[0]![0] as AgentEvent;
    expect(event.sessionId).toBe(sessionId);
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
    expect(event.type).toBe("agent:start");
    expect(event.data).toEqual({ info: "go" });
  });
});
