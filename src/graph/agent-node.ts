// =============================================================================
// AgentNode — Wraps a Agent or nested AgentGraph for graph execution
// =============================================================================

import type { AgentConfig } from "../types.js";
import type { GraphConfig } from "../domain/graph.schema.js";
import type { SharedContext } from "./shared-context.js";
import type { AgentGraph } from "./agent-graph.js";
import { Agent } from "../agent/agent.js";

export interface AgentNodeConfig {
  id: string;
  type: "agent" | "graph";
  agentConfig?: AgentConfig;
  graph?: AgentGraph;
  overrides?: Partial<GraphConfig>;
}

export interface NodeResult {
  nodeId: string;
  output: string;
  tokenUsage?: { input: number; output: number };
  durationMs: number;
}

export class AgentNode {
  readonly id: string;
  readonly type: "agent" | "graph";
  private readonly config: AgentNodeConfig;

  constructor(config: AgentNodeConfig) {
    this.id = config.id;
    this.type = config.type;
    this.config = config;
  }

  async run(prompt: string, sharedContext: SharedContext): Promise<NodeResult> {
    const start = Date.now();

    if (this.config.type === "graph" && this.config.graph) {
      const graphResult = await this.config.graph.run(prompt);
      const result: NodeResult = {
        nodeId: this.id,
        output: graphResult.output,
        tokenUsage: graphResult.totalTokenUsage,
        durationMs: Date.now() - start,
      };
      await sharedContext.setNodeResult(this.id, result.output);
      return result;
    }

    if (!this.config.agentConfig) {
      throw new Error(`Node "${this.id}" has no agentConfig or graph`);
    }

    const agent = Agent.minimal(this.config.agentConfig);
    try {
      const agentResult = await agent.run(prompt);

      const result: NodeResult = {
        nodeId: this.id,
        output: agentResult.text,
        durationMs: Date.now() - start,
      };
      await sharedContext.setNodeResult(this.id, result.output);
      return result;
    } finally {
      await agent.dispose();
    }
  }
}
