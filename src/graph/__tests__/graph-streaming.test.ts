import { describe, it, expect, vi } from "vitest";

import { GraphExecutor } from "../graph-executor.js";
import { SharedContext } from "../shared-context.js";
import { VirtualFilesystem } from "../../adapters/filesystem/virtual-fs.adapter.js";
import type { AgentNode } from "../agent-node.js";
import type { NodeResult } from "../agent-node.js";
import type { GraphConfig, GraphStreamEvent } from "../../domain/graph.schema.js";
import type { ConsensusPort } from "../../ports/consensus.port.js";

// =============================================================================
// Helpers
// =============================================================================

function mockNode(id: string, output = `output-${id}`, delay = 0): AgentNode {
  return {
    id,
    type: "agent",
    run: vi.fn(async (): Promise<NodeResult> => {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      return { nodeId: id, output, durationMs: delay };
    }),
  } as unknown as AgentNode;
}

function failingNode(id: string, error: string): AgentNode {
  return {
    id,
    type: "agent",
    run: vi.fn(async (): Promise<NodeResult> => {
      throw new Error(error);
    }),
  } as unknown as AgentNode;
}

function defaultConfig(overrides?: Partial<GraphConfig>): GraphConfig {
  return {
    maxDepth: 10,
    maxConcurrency: 5,
    timeoutMs: 600_000,
    maxTokenBudget: 1_000_000,
    ...overrides,
  };
}

async function collectEvents(gen: AsyncGenerator<GraphStreamEvent>): Promise<GraphStreamEvent[]> {
  const events: GraphStreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// =============================================================================
// Tests
// =============================================================================

describe("GraphExecutor.stream()", () => {
  it("sequential graph streams events in order", async () => {
    const a = mockNode("a");
    const b = mockNode("b");

    const nodes = new Map([["a", a], ["b", b]]);
    const edges = new Map([["b", ["a"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const events = await collectEvents(executor.stream("prompt"));
    const types = events.map((e) => e.type);

    expect(types).toEqual([
      "graph:start",
      "node:start",      // a
      "node:complete",    // a
      "node:start",      // b
      "node:complete",    // b
      "graph:complete",
    ]);

    // Verify node ordering
    const nodeStarts = events.filter((e) => e.type === "node:start") as Array<{ type: "node:start"; nodeId: string }>;
    expect(nodeStarts[0]!.nodeId).toBe("a");
    expect(nodeStarts[1]!.nodeId).toBe("b");

    // Verify graph:start nodeCount
    const graphStart = events[0] as { type: "graph:start"; nodeCount: number };
    expect(graphStart.nodeCount).toBe(2);

    // Verify graph:complete has result
    const graphComplete = events[events.length - 1] as Extract<GraphStreamEvent, { type: "graph:complete" }>;
    expect(graphComplete.result.output).toBe("output-b");
    expect(graphComplete.result.nodeResults["a"]).toBeDefined();
    expect(graphComplete.result.nodeResults["b"]).toBeDefined();
  });

  it("parallel nodes stream their events", async () => {
    const a = mockNode("a", "out-a", 10);
    const b = mockNode("b", "out-b", 10);
    const c = mockNode("c");

    const nodes = new Map([["a", a], ["b", b], ["c", c]]);
    const edges = new Map([["c", ["a", "b"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const events = await collectEvents(executor.stream("prompt"));
    const types = events.map((e) => e.type);

    // graph:start, then a+b node events (interleaved), then c, then graph:complete
    expect(types[0]).toBe("graph:start");
    expect(types[types.length - 1]).toBe("graph:complete");

    // Both a and b should have start+complete before c starts
    const nodeEvents = events.filter(
      (e) => e.type === "node:start" || e.type === "node:complete",
    ) as Array<{ type: string; nodeId: string }>;

    const cStartIdx = nodeEvents.findIndex((e) => e.type === "node:start" && e.nodeId === "c");
    const aCompleteIdx = nodeEvents.findIndex((e) => e.type === "node:complete" && e.nodeId === "a");
    const bCompleteIdx = nodeEvents.findIndex((e) => e.type === "node:complete" && e.nodeId === "b");

    expect(aCompleteIdx).toBeLessThan(cStartIdx);
    expect(bCompleteIdx).toBeLessThan(cStartIdx);
  });

  it("fork emits fork events", async () => {
    const forkNode0 = mockNode("f__fork_0", "fork-out-0");
    const forkNode1 = mockNode("f__fork_1", "fork-out-1");
    const placeholder = mockNode("f");

    const nodes = new Map([["f", placeholder]]);
    const edges = new Map<string, string[]>();
    const forks = new Map([
      ["f", { nodes: [forkNode0, forkNode1] }],
    ]);

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const events = await collectEvents(executor.stream("prompt"));
    const types = events.map((e) => e.type);

    expect(types).toContain("fork:start");
    expect(types).toContain("fork:complete");

    const forkStart = events.find((e) => e.type === "fork:start") as Extract<GraphStreamEvent, { type: "fork:start" }>;
    expect(forkStart.forkId).toBe("f");
    expect(forkStart.agentCount).toBe(2);

    const forkComplete = events.find((e) => e.type === "fork:complete") as Extract<GraphStreamEvent, { type: "fork:complete" }>;
    expect(forkComplete.results).toHaveLength(2);
  });

  it("fork with consensus emits consensus events", async () => {
    const forkNode0 = mockNode("f__fork_0", "fork-out-0");
    const forkNode1 = mockNode("f__fork_1", "fork-out-1");
    const placeholder = mockNode("f");

    const consensus: ConsensusPort = {
      evaluate: vi.fn(async () => ({
        winnerId: "f__fork_0",
        winnerOutput: "fork-out-0",
        merged: "merged-output",
      })),
    };

    const nodes = new Map([["f", placeholder]]);
    const edges = new Map<string, string[]>();
    const forks = new Map([
      ["f", { nodes: [forkNode0, forkNode1], consensus }],
    ]);

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const events = await collectEvents(executor.stream("prompt"));
    const types = events.map((e) => e.type);

    expect(types).toContain("consensus:start");
    expect(types).toContain("consensus:result");

    const consensusResult = events.find((e) => e.type === "consensus:result") as Extract<GraphStreamEvent, { type: "consensus:result" }>;
    expect(consensusResult.output).toBe("merged-output");
  });

  it("error yields graph:error with partial results", async () => {
    const a = mockNode("a");
    const b = failingNode("b", "node-b-failed");

    const nodes = new Map([["a", a], ["b", b]]);
    const edges = new Map([["b", ["a"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const events = await collectEvents(executor.stream("prompt"));
    const lastEvent = events[events.length - 1]!;

    expect(lastEvent.type).toBe("graph:error");
    const errorEvent = lastEvent as Extract<GraphStreamEvent, { type: "graph:error" }>;
    expect(errorEvent.error).toBe("node-b-failed");
    expect(errorEvent.partialResults["a"]).toBeDefined();
    expect(errorEvent.partialResults["a"]!.output).toBe("output-a");

    // Should also have node:error event
    const nodeError = events.find((e) => e.type === "node:error") as Extract<GraphStreamEvent, { type: "node:error" }>;
    expect(nodeError).toBeDefined();
    expect(nodeError.nodeId).toBe("b");
  });

  it("execute() still works (backward compatibility)", async () => {
    const a = mockNode("a");
    const b = mockNode("b");

    const nodes = new Map([["a", a], ["b", b]]);
    const edges = new Map([["b", ["a"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const result = await executor.execute("prompt");

    expect(result.output).toBe("output-b");
    expect(result.nodeResults["a"]).toBeDefined();
    expect(result.nodeResults["b"]).toBeDefined();
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("execute() throws on error (backward compatibility)", async () => {
    const a = mockNode("a");
    const b = failingNode("b", "node-b-failed");

    const nodes = new Map([["a", a], ["b", b]]);
    const edges = new Map([["b", ["a"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    await expect(executor.execute("prompt")).rejects.toThrow("node-b-failed");
  });

  it("stream collects all node results in graph:complete", async () => {
    const a = mockNode("a");
    const b = mockNode("b");
    const c = mockNode("c");

    const nodes = new Map([["a", a], ["b", b], ["c", c]]);
    const edges = new Map([["b", ["a"]], ["c", ["b"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig(),
      new SharedContext(new VirtualFilesystem()),
    );

    const events = await collectEvents(executor.stream("prompt"));
    const graphComplete = events.find((e) => e.type === "graph:complete") as Extract<GraphStreamEvent, { type: "graph:complete" }>;

    expect(graphComplete).toBeDefined();
    expect(Object.keys(graphComplete.result.nodeResults)).toHaveLength(3);
    expect(graphComplete.result.nodeResults["a"]!.output).toBe("output-a");
    expect(graphComplete.result.nodeResults["b"]!.output).toBe("output-b");
    expect(graphComplete.result.nodeResults["c"]!.output).toBe("output-c");
    expect(graphComplete.result.output).toBe("output-c");
  });
});
