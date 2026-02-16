// =============================================================================
// DefaultCostTrackerAdapter — In-memory cost tracking with model pricing
// =============================================================================

import type { CostTrackerPort, CostTokenUsage, CostEstimate } from "../../ports/cost-tracker.port.js";

// Pricing per 1M tokens: [input, output]
const MODEL_PRICING: Record<string, [number, number]> = {
  // OpenAI
  "gpt-4o":                    [2.50, 10.00],
  "gpt-4o-mini":               [0.15, 0.60],
  "gpt-4-turbo":               [10.00, 30.00],
  // Anthropic
  "claude-sonnet-4-20250514":  [3.00, 15.00],
  "claude-3-haiku":            [0.25, 1.25],
  "claude-opus-4-20250514":    [15.00, 75.00],
  // Google
  "gemini-2.0-flash":          [0.10, 0.40],
  "gemini-1.5-pro":            [1.25, 5.00],
  // Groq
  "llama-3.1-70b":             [0.59, 0.79],
  // Mistral
  "mistral-large":             [2.00, 6.00],
};

export interface CostTrackerOptions {
  budget?: number;
  currency?: string;
  onBudgetExceeded?: () => void;
}

export class DefaultCostTrackerAdapter implements CostTrackerPort {
  private readonly usages: CostTokenUsage[] = [];
  private readonly budget: number | null;
  private readonly currency: string;
  private readonly onBudgetExceeded?: () => void;
  private budgetExceededFired = false;

  constructor(options: CostTrackerOptions = {}) {
    this.budget = options.budget ?? null;
    this.currency = options.currency ?? "USD";
    this.onBudgetExceeded = options.onBudgetExceeded;
  }

  recordUsage(usage: CostTokenUsage): void {
    this.usages.push(usage);
    if (this.onBudgetExceeded && !this.budgetExceededFired && this.isOverBudget()) {
      this.budgetExceededFired = true;
      this.onBudgetExceeded();
    }
  }

  getEstimate(): CostEstimate {
    const byModel = new Map<string, { inputTokens: number; outputTokens: number }>();

    for (const u of this.usages) {
      const existing = byModel.get(u.model) ?? { inputTokens: 0, outputTokens: 0 };
      existing.inputTokens += u.inputTokens;
      existing.outputTokens += u.outputTokens;
      byModel.set(u.model, existing);
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    const breakdown: CostEstimate["breakdown"] = [];

    for (const [model, tokens] of byModel) {
      const cost = this.calculateCost(model, tokens.inputTokens, tokens.outputTokens);
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;
      totalCost += cost;
      breakdown.push({ model, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, cost });
    }

    return { totalInputTokens, totalOutputTokens, totalCost, currency: this.currency, breakdown };
  }

  getSessionBudget(): number | null {
    return this.budget;
  }

  isOverBudget(): boolean {
    if (this.budget === null) return false;
    return this.getEstimate().totalCost > this.budget;
  }

  reset(): void {
    this.usages.length = 0;
    this.budgetExceededFired = false;
  }

  exportUsage(): string {
    return JSON.stringify(this.usages);
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    const [inputPer1M, outputPer1M] = pricing;
    return (inputTokens / 1_000_000) * inputPer1M + (outputTokens / 1_000_000) * outputPer1M;
  }
}
