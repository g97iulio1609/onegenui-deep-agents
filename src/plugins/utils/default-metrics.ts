import type { AgentMetrics } from "../observability.plugin.js";

/** Create a fresh empty AgentMetrics object. */
export function createDefaultMetrics(): AgentMetrics {
  return {
    totalTokens: { input: 0, output: 0 },
    totalLatencyMs: 0,
    toolCalls: [],
    llmCalls: [],
  };
}
