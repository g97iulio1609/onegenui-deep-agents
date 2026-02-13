// =============================================================================
// GraphExecutor — DAG execution engine with concurrency and budget control
// =============================================================================

import type { GraphConfig, GraphResult } from "../domain/graph.schema.js";
import type { ConsensusPort } from "../ports/consensus.port.js";
import type { NodeResult } from "./agent-node.js";
import type { AgentNode } from "./agent-node.js";
import type { SharedContext } from "./shared-context.js";
import type { EventBus } from "../agent/event-bus.js";

export class GraphExecutor {
  constructor(
    private readonly nodes: Map<string, AgentNode>,
    private readonly edges: Map<string, string[]>,
    private readonly forks: Map<
      string,
      { nodes: AgentNode[]; consensus?: ConsensusPort }
    >,
    private readonly config: GraphConfig,
    private readonly sharedContext: SharedContext,
    private readonly eventBus?: EventBus,
  ) {}

  async execute(prompt: string): Promise<GraphResult> {
    const start = Date.now();
    const order = this.topologicalSort();
    const nodeResults = new Map<string, NodeResult>();
    let totalInput = 0;
    let totalOutput = 0;

    this.eventBus?.emit("graph:start", { nodeCount: order.length });

    try {
      const completed = new Set<string>();
      const timeoutAt = start + this.config.timeoutMs;

      while (completed.size < order.length) {
        if (Date.now() > timeoutAt) {
          throw new Error("Graph execution timed out");
        }
        if (totalInput + totalOutput > this.config.maxTokenBudget) {
          throw new Error("Token budget exceeded");
        }

        const ready = order.filter((id) => {
          if (completed.has(id)) return false;
          const deps = this.edges.get(id) ?? [];
          return deps.every((d) => completed.has(d));
        });

        if (ready.length === 0 && completed.size < order.length) {
          throw new Error("Deadlock: no nodes ready but graph incomplete");
        }

        for (let i = 0; i < ready.length; i += this.config.maxConcurrency) {
          const batch = ready.slice(i, i + this.config.maxConcurrency);
          const settled = await Promise.allSettled(
            batch.map((id) => this.executeNode(id, prompt, nodeResults)),
          );

          const errors: Error[] = [];
          for (const outcome of settled) {
            if (outcome.status === "fulfilled") {
              const result = outcome.value;
              nodeResults.set(result.nodeId, result);
              completed.add(result.nodeId);
              if (result.tokenUsage) {
                totalInput += result.tokenUsage.input;
                totalOutput += result.tokenUsage.output;
              }
            } else {
              errors.push(
                outcome.reason instanceof Error
                  ? outcome.reason
                  : new Error(String(outcome.reason)),
              );
            }
          }

          if (errors.length > 0) {
            throw errors[0];
          }
        }
      }

      const lastNodeId = order[order.length - 1]!;
      const lastResult = nodeResults.get(lastNodeId)!;

      const resultMap: Record<string, NodeResult> = {};
      for (const [id, r] of nodeResults) {
        resultMap[id] = r;
      }

      const result: GraphResult = {
        output: lastResult.output,
        nodeResults: resultMap,
        totalDurationMs: Date.now() - start,
        totalTokenUsage: { input: totalInput, output: totalOutput },
      } satisfies GraphResult;

      this.eventBus?.emit("graph:complete", {
        totalDurationMs: result.totalDurationMs,
        totalTokenUsage: result.totalTokenUsage,
      });

      return result;
    } catch (error) {
      this.eventBus?.emit("graph:complete", {
        totalDurationMs: Date.now() - start,
        totalTokenUsage: { input: totalInput, output: totalOutput },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeNode(
    nodeId: string,
    prompt: string,
    previousResults: Map<string, NodeResult>,
  ): Promise<NodeResult> {
    this.eventBus?.emit("node:start", { nodeId });

    try {
      const fork = this.forks.get(nodeId);
      if (fork) {
        const result = await this.executeFork(nodeId, prompt, fork, previousResults);
        this.eventBus?.emit("node:complete", { nodeId, result });
        return result;
      }

      const node = this.nodes.get(nodeId);
      if (!node) throw new Error(`Node "${nodeId}" not found`);

      const enrichedPrompt = this.buildNodePrompt(prompt, nodeId, previousResults);
      const result = await node.run(enrichedPrompt, this.sharedContext);
      this.eventBus?.emit("node:complete", { nodeId, result });
      return result;
    } catch (error) {
      this.eventBus?.emit("node:complete", {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeFork(
    forkId: string,
    prompt: string,
    fork: { nodes: AgentNode[]; consensus?: ConsensusPort },
    previousResults: Map<string, NodeResult>,
  ): Promise<NodeResult> {
    const start = Date.now();
    const enrichedPrompt = this.buildNodePrompt(prompt, forkId, previousResults);

    this.eventBus?.emit("fork:start", { forkId, agentCount: fork.nodes.length });

    let results: NodeResult[];
    try {
      const settled = await Promise.allSettled(
        fork.nodes.map((node) => node.run(enrichedPrompt, this.sharedContext)),
      );

      results = [];
      const errors: Error[] = [];
      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          results.push(outcome.value);
        } else {
          errors.push(
            outcome.reason instanceof Error
              ? outcome.reason
              : new Error(String(outcome.reason)),
          );
        }
      }
      if (errors.length > 0) {
        throw errors[0];
      }

      this.eventBus?.emit("fork:complete", { forkId, resultCount: results.length });
    } catch (error) {
      this.eventBus?.emit("fork:complete", {
        forkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    let output: string;
    let tokenUsage = { input: 0, output: 0 };

    for (const r of results) {
      if (r.tokenUsage) {
        tokenUsage.input += r.tokenUsage.input;
        tokenUsage.output += r.tokenUsage.output;
      }
    }

    if (fork.consensus) {
      this.eventBus?.emit("consensus:start", { forkId });
      try {
        const consensusInput = results.map((r) => ({
          id: r.nodeId,
          output: r.output,
        }));
        const consensusResult = await fork.consensus.evaluate(consensusInput);
        this.eventBus?.emit("consensus:result", {
          forkId,
          winnerId: consensusResult.winnerId,
          merged: !!consensusResult.merged,
        });
        output = consensusResult.merged ?? consensusResult.winnerOutput;
      } catch (error) {
        this.eventBus?.emit("consensus:result", {
          forkId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } else {
      output = results[0]!.output;
    }

    const result: NodeResult = {
      nodeId: forkId,
      output,
      tokenUsage,
      durationMs: Date.now() - start,
    };
    await this.sharedContext.setNodeResult(forkId, output);
    return result;
  }

  private buildNodePrompt(
    basePrompt: string,
    nodeId: string,
    previousResults: Map<string, NodeResult>,
  ): string {
    const deps = this.edges.get(nodeId) ?? [];
    if (deps.length === 0) return basePrompt;

    const context = deps
      .map((depId) => {
        const r = previousResults.get(depId);
        return r ? `[${depId}]: ${r.output}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    return `${basePrompt}\n\n--- Previous results ---\n${context}`;
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const deps = this.edges.get(nodeId) ?? [];
      for (const dep of deps) {
        visit(dep);
      }
      result.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return result;
  }
}
