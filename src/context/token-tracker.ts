// =============================================================================
// TokenTracker — Cumulative token usage tracking
// =============================================================================

import type { TokenCounterPort, TokenBudget } from "../ports/token-counter.port.js";
import type { TokenTrackerSnapshot } from "./types.js";

export class TokenTracker {
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(
    private readonly counter: TokenCounterPort,
    private readonly budget: TokenBudget,
  ) {}

  addInput(tokens: number): void {
    this.inputTokens += tokens;
  }

  addOutput(tokens: number): void {
    this.outputTokens += tokens;
  }

  getUsage(): TokenTrackerSnapshot {
    const totalTokens = this.inputTokens + this.outputTokens;
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens,
      estimatedCost: this.counter.estimateCost(
        this.inputTokens,
        this.outputTokens,
        "",
      ),
      isOverBudget: this.isOverBudget(),
    };
  }

  isOverBudget(): boolean {
    return (
      this.inputTokens > this.budget.maxInputTokens ||
      this.outputTokens > this.budget.maxOutputTokens ||
      this.inputTokens + this.outputTokens > this.budget.maxTotalTokens
    );
  }

  isNearBudget(threshold?: number): boolean {
    const t = threshold ?? this.budget.warningThreshold;
    return (
      this.inputTokens > this.budget.maxInputTokens * t ||
      this.outputTokens > this.budget.maxOutputTokens * t ||
      this.inputTokens + this.outputTokens > this.budget.maxTotalTokens * t
    );
  }

  getRemainingBudget(): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } {
    const total = this.inputTokens + this.outputTokens;
    return {
      inputTokens: Math.max(0, this.budget.maxInputTokens - this.inputTokens),
      outputTokens: Math.max(0, this.budget.maxOutputTokens - this.outputTokens),
      totalTokens: Math.max(0, this.budget.maxTotalTokens - total),
    };
  }

  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
}
