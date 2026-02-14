// =============================================================================
// Eval Schema — Evaluation metrics structures
// =============================================================================

import { z } from "zod";

export const EvalMetricsSchema = z.object({
  latencyMs: z.number().describe("Total run time in milliseconds"),
  stepCount: z.number().describe("Number of reasoning steps"),
  toolCalls: z.record(z.string(), z.number()).describe("Tool call frequency map"),
  tokenUsage: z.object({
    prompt: z.number().default(0),
    completion: z.number().default(0),
    total: z.number().default(0),
  }).optional(),
  customScores: z.record(z.string(), z.number()).default({}).describe("User-defined scores"),
});
export type EvalMetrics = z.infer<typeof EvalMetricsSchema>;

export const EvalResultSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  prompt: z.string(),
  output: z.string(),
  metrics: EvalMetricsSchema,
  createdAt: z.number().default(() => Date.now()),
});
export type EvalResult = z.infer<typeof EvalResultSchema>;
