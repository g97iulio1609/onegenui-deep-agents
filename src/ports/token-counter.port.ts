// =============================================================================
// TokenCounterPort — Token counting and budget contract
// =============================================================================

import type { Message } from "../types.js";

export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  warningThreshold: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface TokenCounterPort {
  /** Count tokens in a text string */
  count(text: string, model?: string): number;

  /** Count tokens across an array of messages */
  countMessages(messages: Message[], model?: string): number;

  /** Get the context window size for a model */
  getContextWindowSize(model: string): number;

  /** Estimate cost for given token usage */
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model: string,
  ): number;

  /** Truncate text to fit within a token budget */
  truncate(text: string, maxTokens: number, model?: string): string;
}
