import { describe, it, expect, vi } from "vitest";

import { AgentOrchestratorAdapter } from "../orchestrator.adapter.js";
import type {
  OrchestrationAgent,
  OrchestrationEvent,
  OrchestrationMessage,
} from "../../../ports/agent-orchestrator.port.js";

// =============================================================================
// Helpers
// =============================================================================

function mockAgent(id: string, transform: (input: string) => string): OrchestrationAgent {
  return {
    id,
    role: id,
    instructions: `Agent ${id}`,
    execute: async (msg: OrchestrationMessage) => ({
      from: id,
      to: msg.from,
      content: transform(msg.content),
    }),
  };
}

function failingAgent(id: string, error = "Agent failed"): OrchestrationAgent {
  return {
    id,
    role: id,
    instructions: `Failing agent ${id}`,
    execute: async () => {
      throw new Error(error);
    },
  };
}

async function collectEvents(stream: AsyncIterable<OrchestrationEvent>): Promise<OrchestrationEvent[]> {
  const events: OrchestrationEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

// =============================================================================
// Tests
// =============================================================================

describe("AgentOrchestratorAdapter", () => {
  const adapter = new AgentOrchestratorAdapter();

  // -------------------------------------------------------------------------
  // Supervisor
  // -------------------------------------------------------------------------

  describe("Supervisor pattern", () => {
    it("delegates to all agents round-robin", async () => {
      const agents = [
        mockAgent("a1", (s) => `A1: ${s}`),
        mockAgent("a2", (s) => `A2: ${s}`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "supervisor",
        agents,
        options: {
          supervisor: { delegationStrategy: "round-robin", aggregationStrategy: "concat" },
        },
      });

      const result = await orch.execute("hello");

      expect(result.pattern).toBe("supervisor");
      expect(result.agentResults.get("a1")!.length).toBeGreaterThan(0);
      expect(result.agentResults.get("a2")!.length).toBeGreaterThan(0);
    });

    it("aggregates results with concat", async () => {
      const agents = [
        mockAgent("a1", () => "part1"),
        mockAgent("a2", () => "part2"),
      ];

      const orch = adapter.createOrchestration({
        pattern: "supervisor",
        agents,
        options: {
          supervisor: { delegationStrategy: "round-robin", aggregationStrategy: "concat" },
        },
      });

      const result = await orch.execute("combine");

      expect(result.output).toContain("part1");
      expect(result.output).toContain("part2");
    });

    it("handles agent failure gracefully", async () => {
      const agents = [
        failingAgent("bad"),
        mockAgent("good", () => "ok"),
      ];

      const orch = adapter.createOrchestration({
        pattern: "supervisor",
        agents,
      });

      const result = await orch.execute("test");

      expect(result.output).toContain("ok");
      expect(result.agentResults.get("bad")![0].metadata?.error).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Swarm
  // -------------------------------------------------------------------------

  describe("Swarm pattern", () => {
    it("exchanges messages on blackboard", async () => {
      const blackboard = new Map<string, unknown>();
      const agents = [
        mockAgent("s1", (s) => `S1 saw: ${s}`),
        mockAgent("s2", (s) => `S2 saw: ${s}`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "swarm",
        agents,
        options: {
          maxRounds: 2,
          swarm: { blackboard },
        },
      });

      const result = await orch.execute("topic");

      expect(blackboard.get("input")).toBe("topic");
      expect(blackboard.has("s1_round_1")).toBe(true);
      expect(blackboard.has("s2_round_1")).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("converges when convergenceCheck returns true", async () => {
      const agents = [
        mockAgent("c1", () => "DONE"),
        mockAgent("c2", () => "DONE"),
      ];

      const convergenceCheck = (msgs: OrchestrationMessage[]) =>
        msgs.every((m) => m.content === "DONE");

      const orch = adapter.createOrchestration({
        pattern: "swarm",
        agents,
        options: {
          maxRounds: 10,
          swarm: { blackboard: new Map(), convergenceCheck },
        },
      });

      const result = await orch.execute("check");

      expect(result.rounds).toBe(1);
    });

    it("respects maxRounds limit", async () => {
      const agents = [
        mockAgent("r1", (s) => `Round: ${s}`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "swarm",
        agents,
        options: { maxRounds: 3 },
      });

      const result = await orch.execute("go");

      expect(result.rounds).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------------

  describe("Pipeline pattern", () => {
    it("chains agents sequentially", async () => {
      const agents = [
        mockAgent("p1", (s) => s.toUpperCase()),
        mockAgent("p2", (s) => `[${s}]`),
        mockAgent("p3", (s) => `${s}!`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "pipeline",
        agents,
      });

      const result = await orch.execute("hello");

      expect(result.output).toBe("[HELLO]!");
      expect(result.pattern).toBe("pipeline");
    });

    it("stops on error with stop strategy", async () => {
      const agents = [
        mockAgent("ok1", (s) => s.toUpperCase()),
        failingAgent("bad1"),
        mockAgent("ok2", (s) => `${s}!`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "pipeline",
        agents,
        options: { pipeline: { errorStrategy: "stop" } },
      });

      const result = await orch.execute("test");

      // Pipeline stops at bad1, output is from ok1
      expect(result.output).toBe("TEST");
      expect(result.agentResults.get("ok2")!.length).toBe(0);
    });

    it("skips failed agent with skip strategy", async () => {
      const agents = [
        mockAgent("ok1", (s) => s.toUpperCase()),
        failingAgent("bad1"),
        mockAgent("ok2", (s) => `${s}!`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "pipeline",
        agents,
        options: { pipeline: { errorStrategy: "skip" } },
      });

      const result = await orch.execute("test");

      // Skips bad1, ok2 receives ok1 output
      expect(result.output).toBe("TEST!");
    });
  });

  // -------------------------------------------------------------------------
  // MapReduce
  // -------------------------------------------------------------------------

  describe("MapReduce pattern", () => {
    it("splits input and processes in parallel", async () => {
      const agents = [
        mockAgent("m1", (s) => s.toUpperCase()),
        mockAgent("m2", (s) => s.toUpperCase()),
      ];

      const orch = adapter.createOrchestration({
        pattern: "map-reduce",
        agents,
        options: {
          mapReduce: {
            splitFn: (input) => input.split(" "),
            reduceFn: (results) => ({
              from: "reducer",
              content: results.map((r) => r.content).join(" "),
            }),
          },
        },
      });

      const result = await orch.execute("hello world foo");

      expect(result.output).toBe("HELLO WORLD FOO");
    });

    it("reduces results with custom function", async () => {
      const agents = [
        mockAgent("cnt", (s) => String(s.length)),
      ];

      const orch = adapter.createOrchestration({
        pattern: "map-reduce",
        agents,
        options: {
          mapReduce: {
            splitFn: (input) => input.split(","),
            reduceFn: (results) => ({
              from: "reducer",
              content: `total: ${results.reduce((sum, r) => sum + Number(r.content), 0)}`,
            }),
          },
        },
      });

      const result = await orch.execute("ab,cde,f");

      expect(result.output).toBe("total: 6");
    });

    it("respects concurrency limit", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const slowAgent: OrchestrationAgent = {
        id: "slow",
        role: "slow",
        instructions: "slow",
        execute: async (msg) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 50));
          concurrent--;
          return { from: "slow", content: msg.content.toUpperCase() };
        },
      };

      const orch = adapter.createOrchestration({
        pattern: "map-reduce",
        agents: [slowAgent],
        options: {
          mapReduce: {
            splitFn: (input) => input.split(" "),
            reduceFn: (results) => ({
              from: "reducer",
              content: results.map((r) => r.content).join(" "),
            }),
            concurrency: 1,
          },
        },
      });

      await orch.execute("a b c d");

      expect(maxConcurrent).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Debate
  // -------------------------------------------------------------------------

  describe("Debate pattern", () => {
    it("runs specified number of rounds", async () => {
      const executeSpy = vi.fn(async (msg: OrchestrationMessage) => ({
        from: "d1",
        to: msg.from,
        content: "My argument",
      }));

      const agents: OrchestrationAgent[] = [
        { id: "d1", role: "debater", instructions: "argue", execute: executeSpy },
        {
          id: "judge",
          role: "judge",
          instructions: "judge",
          execute: async () => ({ from: "judge", content: "Winner: d1" }),
        },
      ];

      const orch = adapter.createOrchestration({
        pattern: "debate",
        agents,
        options: {
          debate: { rounds: 3, judgeAgentId: "judge", votingStrategy: "judge" },
        },
      });

      const result = await orch.execute("topic");

      expect(result.rounds).toBe(3);
      expect(executeSpy).toHaveBeenCalledTimes(3);
    });

    it("judge picks winner", async () => {
      const agents: OrchestrationAgent[] = [
        mockAgent("d1", () => "Position A"),
        mockAgent("d2", () => "Position B"),
        {
          id: "judge",
          role: "judge",
          instructions: "judge",
          execute: async () => ({
            from: "judge",
            content: "Winner: Position A is stronger",
          }),
        },
      ];

      const orch = adapter.createOrchestration({
        pattern: "debate",
        agents,
        options: {
          debate: { rounds: 2, judgeAgentId: "judge", votingStrategy: "judge" },
        },
      });

      const result = await orch.execute("debate topic");

      expect(result.output).toBe("Winner: Position A is stronger");
      expect(result.agentResults.get("judge")!.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Streaming
  // -------------------------------------------------------------------------

  describe("Streaming", () => {
    it("emits events in correct order", async () => {
      const agents = [
        mockAgent("s1", (s) => `Done: ${s}`),
      ];

      const orch = adapter.createOrchestration({
        pattern: "supervisor",
        agents,
      });

      const events = await collectEvents(orch.stream("test"));
      const types = events.map((e) => e.type);

      expect(types[0]).toBe("round_start");
      expect(types).toContain("agent_start");
      expect(types).toContain("message");
      expect(types).toContain("agent_end");
      expect(types).toContain("round_end");
      expect(types[types.length - 1]).toBe("complete");
    });
  });

  // -------------------------------------------------------------------------
  // Cancellation
  // -------------------------------------------------------------------------

  describe("Cancellation", () => {
    it("cancel aborts running orchestration", async () => {
      let callCount = 0;
      const agent: OrchestrationAgent = {
        id: "counter",
        role: "counter",
        instructions: "counter",
        execute: async (msg) => {
          callCount++;
          await new Promise((r) => setTimeout(r, 10));
          return { from: "counter", content: msg.content };
        },
      };

      const orch = adapter.createOrchestration({
        pattern: "swarm",
        agents: [agent],
        options: { maxRounds: 100 },
      });

      const promise = orch.execute("cancel me");
      setTimeout(() => orch.cancel(), 50);

      const result = await promise;

      expect(result.rounds).toBeLessThan(100);
      expect(callCount).toBeLessThan(100);
    });
  });

  // -------------------------------------------------------------------------
  // OrchestrationResult
  // -------------------------------------------------------------------------

  describe("OrchestrationResult", () => {
    it("contains all agent results", async () => {
      const agents = [
        mockAgent("r1", () => "res1"),
        mockAgent("r2", () => "res2"),
        mockAgent("r3", () => "res3"),
      ];

      const orch = adapter.createOrchestration({
        pattern: "supervisor",
        agents,
      });

      const result = await orch.execute("input");

      expect(result.agentResults.size).toBe(3);
      expect(result.agentResults.has("r1")).toBe(true);
      expect(result.agentResults.has("r2")).toBe(true);
      expect(result.agentResults.has("r3")).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.messages.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe("Validation", () => {
    it("empty agents list throws error", () => {
      expect(() =>
        adapter.createOrchestration({
          pattern: "supervisor",
          agents: [],
        }),
      ).toThrow("At least one agent is required");
    });

    it("invalid pattern throws error", () => {
      expect(() =>
        adapter.createOrchestration({
          pattern: "invalid" as any,
          agents: [mockAgent("a", (s) => s)],
        }),
      ).toThrow("Invalid orchestration pattern");
    });
  });

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  describe("Timeout", () => {
    it("timeout cancels long-running orchestration", async () => {
      const agent: OrchestrationAgent = {
        id: "counter",
        role: "counter",
        instructions: "counter",
        execute: async (msg) => {
          await new Promise((r) => setTimeout(r, 10));
          return { from: "counter", content: msg.content };
        },
      };

      const orch = adapter.createOrchestration({
        pattern: "swarm",
        agents: [agent],
        options: { timeout: 80, maxRounds: 100 },
      });

      const result = await orch.execute("timeout test");

      expect(result.rounds).toBeLessThan(100);
    });
  });
});
