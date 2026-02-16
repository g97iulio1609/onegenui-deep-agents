// =============================================================================
// GraphExecutor — DAG execution engine with concurrency and budget control
// =============================================================================

import type { GraphConfig, GraphResult, GraphStreamEvent } from "../domain/graph.schema.js";
import type { ConsensusPort } from "../ports/consensus.port.js";
import type { NodeResult } from "./agent-node.js";
import type { AgentNode } from "./agent-node.js";
import type { SharedContext } from "./shared-context.js";
import type { EventBus } from "../agent/event-bus.js";
import type { TelemetryPort } from "../ports/telemetry.port.js";

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
    private readonly telemetry?: TelemetryPort,
  ) {}

  async execute(prompt: string): Promise<GraphResult> {
    let result: GraphResult | undefined;
    for await (const event of this.stream(prompt)) {
      if (event.type === "graph:complete") {
        result = event.result;
      }
      if (event.type === "graph:error") {
        throw new Error(event.error);
      }
    }
    if (!result) throw new Error("Graph execution produced no result");
    return result;
  }

  async *stream(prompt: string): AsyncGenerator<GraphStreamEvent> {
    const start = Date.now();
    const order = this.topologicalSort();
    const nodeResults = new Map<string, NodeResult>();
    let totalInput = 0;
    let totalOutput = 0;

    this.eventBus?.emit("graph:start", { nodeCount: order.length });
    yield { type: "graph:start", nodeCount: order.length };

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
          const batchEvents: GraphStreamEvent[][] = batch.map(() => []);
          const settled = await Promise.allSettled(
            batch.map((id, idx) =>
              this.executeNodeWithEvents(id, prompt, nodeResults, batchEvents[idx]!),
            ),
          );

          // Yield all collected events from the batch
          for (const events of batchEvents) {
            for (const event of events) {
              yield event;
            }
          }

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

      yield { type: "graph:complete", result };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.eventBus?.emit("graph:complete", {
        totalDurationMs: Date.now() - start,
        totalTokenUsage: { input: totalInput, output: totalOutput },
        error: errorMsg,
      });

      const partialResults: Record<string, NodeResult> = {};
      for (const [id, r] of nodeResults) {
        partialResults[id] = r;
      }
      yield { type: "graph:error", error: errorMsg, partialResults };
    }
  }

  private async executeNodeWithEvents(
    nodeId: string,
    prompt: string,
    previousResults: Map<string, NodeResult>,
    events: GraphStreamEvent[],
  ): Promise<NodeResult> {
    this.eventBus?.emit("node:start", { nodeId });
    events.push({ type: "node:start", nodeId });
    const nodeSpan = this.telemetry?.startSpan(`graph.node.${nodeId}`, { "node.id": nodeId });

    try {
      const fork = this.forks.get(nodeId);
      if (fork) {
        const result = await this.executeForkWithEvents(nodeId, prompt, fork, previousResults, events);
        this.eventBus?.emit("node:complete", { nodeId, result });
        events.push({ type: "node:complete", nodeId, result });
        nodeSpan?.setStatus("OK");
        nodeSpan?.end();
        return result;
      }

      const node = this.nodes.get(nodeId);
      if (!node) throw new Error(`Node "${nodeId}" not found`);

      const enrichedPrompt = this.buildNodePrompt(prompt, nodeId, previousResults);
      const result = await node.run(enrichedPrompt, this.sharedContext);
      this.eventBus?.emit("node:complete", { nodeId, result });
      events.push({ type: "node:complete", nodeId, result });
      nodeSpan?.setAttribute("node.duration_ms", result.durationMs);
      nodeSpan?.setStatus("OK");
      nodeSpan?.end();
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.eventBus?.emit("node:complete", { nodeId, error: errorMsg });
      events.push({ type: "node:error", nodeId, error: errorMsg });
      nodeSpan?.setStatus("ERROR", errorMsg);
      nodeSpan?.end();
      throw error;
    }
  }

  private async executeForkWithEvents(
    forkId: string,
    prompt: string,
    fork: { nodes: AgentNode[]; consensus?: ConsensusPort },
    previousResults: Map<string, NodeResult>,
    events: GraphStreamEvent[],
  ): Promise<NodeResult> {
    const start = Date.now();
    const enrichedPrompt = this.buildNodePrompt(prompt, forkId, previousResults);

    this.eventBus?.emit("fork:start", { forkId, agentCount: fork.nodes.length });
    events.push({ type: "fork:start", forkId, agentCount: fork.nodes.length });

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
      events.push({ type: "fork:complete", forkId, results });
    } catch (error) {
      this.eventBus?.emit("fork:complete", {
        forkId,
        error: error instanceof Error ? error.message : String(error),
      });
      events.push({ type: "fork:complete", forkId, results: [] });
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
      events.push({ type: "consensus:start", forkId });
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
        events.push({ type: "consensus:result", forkId, output });
      } catch (error) {
        this.eventBus?.emit("consensus:result", {
          forkId,
          error: error instanceof Error ? error.message : String(error),
        });
        events.push({ type: "consensus:result", forkId, output: "" });
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
