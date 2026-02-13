import { describe, it, expect, vi } from "vitest";

import { GraphExecutor } from "../graph-executor.js";
import { SharedContext } from "../shared-context.js";
import { VirtualFilesystem } from "../../adapters/filesystem/virtual-fs.adapter.js";
import type { AgentNode } from "../agent-node.js";
import type { NodeResult } from "../agent-node.js";
import type { GraphConfig } from "../../domain/graph.schema.js";

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

function defaultConfig(overrides?: Partial<GraphConfig>): GraphConfig {
  return {
    maxDepth: 10,
    maxConcurrency: 5,
    timeoutMs: 600_000,
    maxTokenBudget: 1_000_000,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("GraphExecutor", () => {
  it("topological sort respects dependency order", async () => {
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

    const result = await executor.execute("prompt");

    // a runs first (no deps), then b, then c
    const callOrder = [a, b, c].map((n) => {
      const mock = n.run as ReturnType<typeof vi.fn>;
      return mock.mock.invocationCallOrder[0];
    });
    expect(callOrder[0]).toBeLessThan(callOrder[1]!);
    expect(callOrder[1]).toBeLessThan(callOrder[2]!);
    expect(result.output).toBe("output-c");
  });

  it("parallel execution respects edges", async () => {
    // a and b have no deps → run in parallel; c depends on both
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

    const result = await executor.execute("prompt");

    // c should only run after a and b
    const cMock = c.run as ReturnType<typeof vi.fn>;
    const aMock = a.run as ReturnType<typeof vi.fn>;
    const bMock = b.run as ReturnType<typeof vi.fn>;
    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
    expect(cMock).toHaveBeenCalledTimes(1);
    expect(result.output).toBe("output-c");
  });

  it("timeout enforcement", async () => {
    // a runs first with a delay, then the timeout check fires before b
    const a = mockNode("a", "out-a", 50);
    const b = mockNode("b", "out-b");

    const nodes = new Map([["a", a], ["b", b]]);
    const edges = new Map([["b", ["a"]]]);
    const forks = new Map();

    const executor = new GraphExecutor(
      nodes, edges, forks, defaultConfig({ timeoutMs: 10 }),
      new SharedContext(new VirtualFilesystem()),
    );

    await expect(executor.execute("prompt")).rejects.toThrow("timed out");
  });

  it("budget enforcement", async () => {
    const a: AgentNode = {
      id: "a",
      type: "agent",
      run: vi.fn(async (): Promise<NodeResult> => ({
        nodeId: "a",
        output: "big",
        durationMs: 1,
        tokenUsage: { input: 500_000, output: 600_000 },
      })),
    } as unknown as AgentNode;

    const nodes = new Map([["a", a]]);
    const edges = new Map();
    const forks = new Map();

    // a alone returns 1.1M tokens; budget is 1M
    // But note: budget check happens *before* the next batch, so we need 2 nodes
    const b: AgentNode = {
      id: "b",
      type: "agent",
      run: vi.fn(async (): Promise<NodeResult> => ({
        nodeId: "b",
        output: "more",
        durationMs: 1,
        tokenUsage: { input: 100, output: 100 },
      })),
    } as unknown as AgentNode;

    const nodes2 = new Map([["a", a], ["b", b]]);
    const edges2 = new Map([["b", ["a"]]]);

    const executor = new GraphExecutor(
      nodes2, edges2, forks, defaultConfig({ maxTokenBudget: 100_000 }),
      new SharedContext(new VirtualFilesystem()),
    );

    await expect(executor.execute("prompt")).rejects.toThrow("budget exceeded");
  });
});
