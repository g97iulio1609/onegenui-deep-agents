// =============================================================================
// InMemoryCostTracker — In-memory budget-aware cost tracker
// =============================================================================

import type {
  BudgetCostTrackerPort,
  CostEvent,
  CostPeriod,
  CostSummary,
  Budget,
  BudgetResult,
} from "../../ports/budget-cost-tracker.port.js";

const PERIOD_MS: Record<string, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
};

export class InMemoryCostTracker implements BudgetCostTrackerPort {
  private readonly events = new Map<string, CostEvent[]>();
  private readonly budgets = new Map<string, Budget>();

  record(event: CostEvent): void {
    const e: CostEvent = { ...event, timestamp: event.timestamp ?? Date.now() };
    const list = this.events.get(e.key) ?? [];
    list.push(e);
    this.events.set(e.key, list);
  }

  getCost(key: string, period?: CostPeriod): CostSummary {
    let events = this.events.get(key) ?? [];

    if (period) {
      events = events.filter((e) => {
        const ts = e.timestamp!;
        if (period.since !== undefined && ts < period.since) return false;
        if (period.until !== undefined && ts > period.until) return false;
        return true;
      });
    }

    const byModel: CostSummary["byModel"] = {};
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const e of events) {
      totalCost += e.cost;
      totalInputTokens += e.inputTokens;
      totalOutputTokens += e.outputTokens;

      const m = byModel[e.model] ?? { cost: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
      m.cost += e.cost;
      m.inputTokens += e.inputTokens;
      m.outputTokens += e.outputTokens;
      m.requests += 1;
      byModel[e.model] = m;
    }

    const totalRequests = events.length;

    return {
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      totalRequests,
      byModel,
      averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
    };
  }

  checkBudget(key: string, budget: Budget): BudgetResult {
    const period = this.budgetPeriod(budget);
    const summary = this.getCost(key, period);
    const exceededLimits: string[] = [];

    if (summary.totalCost > budget.maxCost) {
      exceededLimits.push("maxCost");
    }
    if (budget.maxTokens !== undefined) {
      const totalTokens = summary.totalInputTokens + summary.totalOutputTokens;
      if (totalTokens > budget.maxTokens) {
        exceededLimits.push("maxTokens");
      }
    }
    if (budget.maxRequests !== undefined && summary.totalRequests > budget.maxRequests) {
      exceededLimits.push("maxRequests");
    }

    const percentUsed = budget.maxCost > 0 ? (summary.totalCost / budget.maxCost) * 100 : 0;

    return {
      withinBudget: exceededLimits.length === 0,
      currentCost: summary.totalCost,
      remainingCost: Math.max(0, budget.maxCost - summary.totalCost),
      percentUsed,
      exceededLimits,
    };
  }

  setBudget(key: string, budget: Budget): void {
    this.budgets.set(key, budget);
  }

  listBudgets(): Array<{ key: string; budget: Budget }> {
    return Array.from(this.budgets.entries()).map(([key, budget]) => ({ key, budget }));
  }

  reset(key: string): void {
    this.events.delete(key);
  }

  private budgetPeriod(budget: Budget): CostPeriod | undefined {
    if (!budget.period || budget.period === "total") return undefined;
    const ms = PERIOD_MS[budget.period];
    if (!ms) return undefined;
    return { since: Date.now() - ms };
  }
}
