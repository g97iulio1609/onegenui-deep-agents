import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryCostTracker } from "../cost-tracker.adapter.js";
import type { CostEvent, Budget } from "../../../ports/budget-cost-tracker.port.js";

function event(overrides: Partial<CostEvent> = {}): CostEvent {
  return {
    key: "agent-1",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 50,
    cost: 0.01,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("InMemoryCostTracker", () => {
  let tracker: InMemoryCostTracker;

  beforeEach(() => {
    tracker = new InMemoryCostTracker();
  });

  // -------------------------------------------------------------------------
  // record / getCost
  // -------------------------------------------------------------------------
  it("record stores cost event", () => {
    tracker.record(event());
    const s = tracker.getCost("agent-1");
    expect(s.totalRequests).toBe(1);
    expect(s.totalCost).toBe(0.01);
  });

  it("getCost returns total for key", () => {
    tracker.record(event({ cost: 0.05 }));
    tracker.record(event({ cost: 0.03 }));
    const s = tracker.getCost("agent-1");
    expect(s.totalCost).toBeCloseTo(0.08);
    expect(s.totalRequests).toBe(2);
  });

  it("getCost with period filters by time", () => {
    const old = Date.now() - 100_000;
    tracker.record(event({ cost: 0.10, timestamp: old }));
    tracker.record(event({ cost: 0.05, timestamp: Date.now() }));
    const s = tracker.getCost("agent-1", { since: Date.now() - 1000 });
    expect(s.totalCost).toBeCloseTo(0.05);
    expect(s.totalRequests).toBe(1);
  });

  it("getCost byModel aggregates correctly", () => {
    tracker.record(event({ model: "gpt-4", cost: 0.02, inputTokens: 100, outputTokens: 50 }));
    tracker.record(event({ model: "gpt-4", cost: 0.03, inputTokens: 200, outputTokens: 100 }));
    tracker.record(event({ model: "claude-3", cost: 0.01, inputTokens: 50, outputTokens: 25 }));
    const s = tracker.getCost("agent-1");
    expect(Object.keys(s.byModel)).toHaveLength(2);
    expect(s.byModel["gpt-4"].requests).toBe(2);
    expect(s.byModel["gpt-4"].inputTokens).toBe(300);
    expect(s.byModel["claude-3"].requests).toBe(1);
  });

  it("getCost averageCostPerRequest is accurate", () => {
    tracker.record(event({ cost: 0.10 }));
    tracker.record(event({ cost: 0.20 }));
    const s = tracker.getCost("agent-1");
    expect(s.averageCostPerRequest).toBeCloseTo(0.15);
  });

  // -------------------------------------------------------------------------
  // checkBudget
  // -------------------------------------------------------------------------
  it("checkBudget within budget returns true", () => {
    tracker.record(event({ cost: 0.05 }));
    const r = tracker.checkBudget("agent-1", { maxCost: 1.0 });
    expect(r.withinBudget).toBe(true);
    expect(r.exceededLimits).toHaveLength(0);
  });

  it("checkBudget exceeded returns false", () => {
    tracker.record(event({ cost: 2.0 }));
    const r = tracker.checkBudget("agent-1", { maxCost: 1.0 });
    expect(r.withinBudget).toBe(false);
    expect(r.exceededLimits).toContain("maxCost");
  });

  it("checkBudget reports percentUsed", () => {
    tracker.record(event({ cost: 0.50 }));
    const r = tracker.checkBudget("agent-1", { maxCost: 1.0 });
    expect(r.percentUsed).toBeCloseTo(50);
    expect(r.remainingCost).toBeCloseTo(0.50);
  });

  it("checkBudget checks maxTokens", () => {
    tracker.record(event({ inputTokens: 500, outputTokens: 600, cost: 0.01 }));
    const r = tracker.checkBudget("agent-1", { maxCost: 10, maxTokens: 1000 });
    expect(r.withinBudget).toBe(false);
    expect(r.exceededLimits).toContain("maxTokens");
  });

  it("checkBudget checks maxRequests", () => {
    tracker.record(event({ cost: 0.01 }));
    tracker.record(event({ cost: 0.01 }));
    tracker.record(event({ cost: 0.01 }));
    const r = tracker.checkBudget("agent-1", { maxCost: 10, maxRequests: 2 });
    expect(r.withinBudget).toBe(false);
    expect(r.exceededLimits).toContain("maxRequests");
  });

  // -------------------------------------------------------------------------
  // setBudget / listBudgets
  // -------------------------------------------------------------------------
  it("setBudget stores budget", () => {
    const b: Budget = { maxCost: 5.0, period: "daily" };
    tracker.setBudget("agent-1", b);
    const list = tracker.listBudgets();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe("agent-1");
    expect(list[0].budget.maxCost).toBe(5.0);
  });

  it("listBudgets returns all", () => {
    tracker.setBudget("a", { maxCost: 1 });
    tracker.setBudget("b", { maxCost: 2 });
    tracker.setBudget("c", { maxCost: 3 });
    expect(tracker.listBudgets()).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // reset / independence
  // -------------------------------------------------------------------------
  it("reset clears costs for key", () => {
    tracker.record(event({ cost: 1.0 }));
    tracker.reset("agent-1");
    const s = tracker.getCost("agent-1");
    expect(s.totalCost).toBe(0);
    expect(s.totalRequests).toBe(0);
  });

  it("multiple keys are independent", () => {
    tracker.record(event({ key: "a", cost: 0.10 }));
    tracker.record(event({ key: "b", cost: 0.20 }));
    expect(tracker.getCost("a").totalCost).toBeCloseTo(0.10);
    expect(tracker.getCost("b").totalCost).toBeCloseTo(0.20);
    tracker.reset("a");
    expect(tracker.getCost("a").totalCost).toBe(0);
    expect(tracker.getCost("b").totalCost).toBeCloseTo(0.20);
  });
});
