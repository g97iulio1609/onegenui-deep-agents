// =============================================================================
// BudgetCostTrackerPort — Enhanced cost tracking with budgets and multi-key support
// =============================================================================

export interface BudgetCostTrackerPort {
  /** Record a cost event */
  record(event: CostEvent): void;

  /** Get total cost for a key (agent, user, session) */
  getCost(key: string, period?: CostPeriod): CostSummary;

  /** Check if a key has exceeded its budget */
  checkBudget(key: string, budget: Budget): BudgetResult;

  /** Set a budget for a key */
  setBudget(key: string, budget: Budget): void;

  /** Get all budgets */
  listBudgets(): Array<{ key: string; budget: Budget }>;

  /** Reset costs for a key */
  reset(key: string): void;
}

export interface CostEvent {
  key: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface CostPeriod {
  since?: number;
  until?: number;
}

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byModel: Record<string, { cost: number; inputTokens: number; outputTokens: number; requests: number }>;
  averageCostPerRequest: number;
}

export interface Budget {
  maxCost: number;
  maxTokens?: number;
  maxRequests?: number;
  period?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'total';
}

export interface BudgetResult {
  withinBudget: boolean;
  currentCost: number;
  remainingCost: number;
  percentUsed: number;
  exceededLimits: string[];
}
