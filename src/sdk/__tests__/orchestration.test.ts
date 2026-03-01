/**
 * Unit tests for Graph, Workflow, Network SDK modules.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("gauss-napi", () => ({
  // Provider (needed by Agent constructor)
  create_provider: vi.fn(() => 100),
  destroy_provider: vi.fn(),
  version: vi.fn(() => "1.0.0"),

  // Graph
  create_graph: vi.fn(() => 10),
  graph_add_node: vi.fn(),
  graph_add_edge: vi.fn(),
  graph_run: vi.fn(async () => ({ research: "done", write: "done" })),
  destroy_graph: vi.fn(),

  // Workflow
  create_workflow: vi.fn(() => 20),
  workflow_add_step: vi.fn(),
  workflow_add_dependency: vi.fn(),
  workflow_run: vi.fn(async () => ({ step1: "ok", step2: "ok" })),
  destroy_workflow: vi.fn(),

  // Network
  create_network: vi.fn(() => 30),
  network_add_agent: vi.fn(),
  network_set_supervisor: vi.fn(),
  network_delegate: vi.fn(async () => ({ result: "delegated" })),
  network_agent_cards: vi.fn(() => [{ name: "a1" }]),
  destroy_network: vi.fn(),
}));

import { Agent } from "../agent.js";
import { Graph } from "../graph.js";
import { Workflow } from "../workflow.js";
import { Network } from "../network.js";
import { graph_add_node, graph_add_edge, destroy_graph } from "gauss-napi";

beforeEach(() => vi.clearAllMocks());

describe("Graph", () => {
  it("builds and runs a graph pipeline", async () => {
    const a1 = new Agent({ name: "researcher", providerOptions: { apiKey: "k" } });
    const a2 = new Agent({ name: "writer", providerOptions: { apiKey: "k" } });

    const g = new Graph()
      .addNode({ nodeId: "research", agent: a1 })
      .addNode({ nodeId: "write", agent: a2 })
      .addEdge("research", "write");

    expect(graph_add_node).toHaveBeenCalledTimes(2);
    expect(graph_add_edge).toHaveBeenCalledWith(10, "research", "write");

    const result = await g.run("Write about AI");
    expect(result).toEqual({ research: "done", write: "done" });

    g.destroy();
    a1.destroy();
    a2.destroy();
    expect(destroy_graph).toHaveBeenCalledOnce();
  });

  it("throws after destroy", async () => {
    const g = new Graph();
    g.destroy();
    await expect(g.run("test")).rejects.toThrow("Graph has been destroyed");
  });
});

describe("Workflow", () => {
  it("builds and runs a workflow with dependencies", async () => {
    const a1 = new Agent({ name: "step1", providerOptions: { apiKey: "k" } });
    const a2 = new Agent({ name: "step2", providerOptions: { apiKey: "k" } });

    const wf = new Workflow()
      .addStep({ stepId: "s1", agent: a1, instructions: "Do step 1" })
      .addStep({ stepId: "s2", agent: a2 })
      .addDependency("s2", "s1");

    const result = await wf.run("Execute workflow");
    expect(result).toEqual({ step1: "ok", step2: "ok" });

    wf.destroy();
    a1.destroy();
    a2.destroy();
  });
});

describe("Network", () => {
  it("creates a multi-agent network with supervisor", async () => {
    const a1 = new Agent({ name: "analyst", providerOptions: { apiKey: "k" } });
    const a2 = new Agent({ name: "coder", providerOptions: { apiKey: "k" } });

    const net = new Network()
      .addAgent(a1)
      .addAgent(a2)
      .setSupervisor("analyst");

    const result = await net.delegate("analyst", "coder", "Write code");
    expect(result).toEqual({ result: "delegated" });

    const cards = net.agentCards();
    expect(cards).toEqual([{ name: "a1" }]);

    net.destroy();
    a1.destroy();
    a2.destroy();
  });
});
