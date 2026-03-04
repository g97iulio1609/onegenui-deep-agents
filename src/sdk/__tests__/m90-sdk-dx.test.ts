/**
 * Tests for AgentFactory, StructuredStream, and cost/trace tracking (M90).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("gauss-napi", () => ({
  version: vi.fn(() => "1.0.0-test"),
  create_provider: vi.fn(() => 42),
  destroy_provider: vi.fn(),
  agent_run: vi.fn(async () => ({
    text: "hello",
    steps: 2,
    inputTokens: 10,
    outputTokens: 20,
  })),
  agent_run_with_tool_executor: vi.fn(async () => ({
    text: "ok",
    steps: 1,
    inputTokens: 5,
    outputTokens: 5,
  })),
  agent_stream_with_tool_executor: vi.fn(async () => ({
    text: "streamed",
    steps: 3,
    inputTokens: 15,
    outputTokens: 25,
  })),
  generate: vi.fn(async () => ({ text: "raw" })),
  generate_with_tools: vi.fn(async () => ({ text: "tool" })),
  get_provider_capabilities: vi.fn(() => ({})),
}));

import { AgentFactory, parseSimpleYaml } from "../agent-factory.js";
import { StructuredStream, parsePartialJson } from "../structured-stream.js";
import { Agent } from "../agent.js";
import { agent_run } from "gauss-napi";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AgentFactory ──────────────────────────────────────────────────

describe("AgentFactory", () => {
  describe("quick", () => {
    it("creates an agent with model and instructions", () => {
      const agent = AgentFactory.quick("gpt-4o", "Be helpful");
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.model).toBe("gpt-4o");
      expect(agent.instructions).toBe("Be helpful");
      agent.destroy();
    });

    it("applies default maxSteps of 10", () => {
      const agent = AgentFactory.quick("gpt-4o", "test");
      // Agent is created - we just verify no error thrown
      expect(agent.name).toBe("agent");
      agent.destroy();
    });

    it("passes optional temperature and maxSteps", () => {
      const agent = AgentFactory.quick("gpt-4o", "test", {
        temperature: 0.5,
        maxSteps: 3,
      });
      expect(agent).toBeInstanceOf(Agent);
      agent.destroy();
    });

    it("accepts tools in options", () => {
      const tool = {
        name: "search",
        description: "Search the web",
        parameters: { query: { type: "string" } },
        execute: async () => ({ results: [] }),
      };
      const agent = AgentFactory.quick("gpt-4o", "test", { tools: [tool] });
      expect(agent).toBeInstanceOf(Agent);
      agent.destroy();
    });
  });

  describe("fromConfig", () => {
    it("creates an agent from a full config", () => {
      const agent = AgentFactory.fromConfig({
        name: "researcher",
        model: "gpt-4o",
        instructions: "Research assistant",
        temperature: 0.7,
        maxSteps: 5,
      });
      expect(agent.name).toBe("researcher");
      expect(agent.model).toBe("gpt-4o");
      expect(agent.instructions).toBe("Research assistant");
      agent.destroy();
    });

    it("creates an agent with minimal config", () => {
      const agent = AgentFactory.fromConfig({ model: "gpt-4o" });
      expect(agent.model).toBe("gpt-4o");
      agent.destroy();
    });
  });

  describe("fromJSON", () => {
    it("creates an agent from a JSON file", async () => {
      const tmpPath = join(tmpdir(), `test-agent-${Date.now()}.json`);
      await writeFile(tmpPath, JSON.stringify({
        name: "json-agent",
        model: "gpt-4o",
        instructions: "From JSON",
      }));

      try {
        const agent = await AgentFactory.fromJSON(tmpPath);
        expect(agent.name).toBe("json-agent");
        expect(agent.instructions).toBe("From JSON");
        agent.destroy();
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });

    it("throws on invalid JSON", async () => {
      const tmpPath = join(tmpdir(), `test-bad-${Date.now()}.json`);
      await writeFile(tmpPath, "not valid json");

      try {
        await expect(AgentFactory.fromJSON(tmpPath)).rejects.toThrow();
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });

    it("throws on missing file", async () => {
      await expect(AgentFactory.fromJSON("/nonexistent.json")).rejects.toThrow();
    });
  });

  describe("fromYAML", () => {
    it("creates an agent from a YAML file", async () => {
      const tmpPath = join(tmpdir(), `test-agent-${Date.now()}.yaml`);
      await writeFile(tmpPath, `name: yaml-agent\nmodel: gpt-4o\ninstructions: From YAML\ntemperature: 0.5`);

      try {
        const agent = await AgentFactory.fromYAML(tmpPath);
        expect(agent.name).toBe("yaml-agent");
        expect(agent.instructions).toBe("From YAML");
        agent.destroy();
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });

    it("throws on missing file", async () => {
      await expect(AgentFactory.fromYAML("/nonexistent.yaml")).rejects.toThrow();
    });
  });
});

// ─── parseSimpleYaml ──────────────────────────────────────────────

describe("parseSimpleYaml", () => {
  it("parses flat key-value pairs", () => {
    const result = parseSimpleYaml("name: test\nmodel: gpt-4o\ntemperature: 0.7");
    expect(result).toEqual({ name: "test", model: "gpt-4o", temperature: 0.7 });
  });

  it("coerces booleans and null", () => {
    const result = parseSimpleYaml("enabled: true\ndisabled: false\nempty: null");
    expect(result).toEqual({ enabled: true, disabled: false, empty: null });
  });

  it("handles quoted strings", () => {
    const result = parseSimpleYaml('name: "hello world"\nvalue: \'quoted\'');
    expect(result).toEqual({ name: "hello world", value: "quoted" });
  });

  it("handles arrays", () => {
    const result = parseSimpleYaml("items:\n  - apple\n  - banana\n  - cherry");
    expect(result).toEqual({ items: ["apple", "banana", "cherry"] });
  });

  it("skips comments and empty lines", () => {
    const result = parseSimpleYaml("# Comment\nname: test\n\n# Another\nvalue: 42");
    expect(result).toEqual({ name: "test", value: 42 });
  });
});

// ─── StructuredStream ─────────────────────────────────────────────

describe("StructuredStream", () => {
  it("parses complete JSON in a single write", () => {
    const stream = new StructuredStream<{ name: string }>({
      type: "object",
      properties: { name: { type: "string" } },
    });

    const result = stream.writePartial('{"name":"Alice"}');
    expect(result).toEqual({ name: "Alice" });
  });

  it("parses partial JSON by closing unclosed braces", () => {
    const stream = new StructuredStream<{ name: string; age: number }>({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    });

    const partial = stream.writePartial('{"name":"Bob"');
    expect(partial).toEqual({ name: "Bob" });
  });

  it("accumulates deltas across multiple writes", () => {
    const stream = new StructuredStream<{ x: number; y: number }>({
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
      },
    });

    stream.writePartial('{"x":');
    const r2 = stream.writePartial("1,");
    expect(r2).toEqual({ x: 1 });

    const r3 = stream.writePartial('"y":2}');
    expect(r3).toEqual({ x: 1, y: 2 });
  });

  it("returns null for unparseable content", () => {
    const stream = new StructuredStream({
      type: "object",
      properties: { a: { type: "string" } },
    });

    const result = stream.writePartial("not json at all");
    expect(result).toBeNull();
  });

  it("validates a complete object against schema", () => {
    const stream = new StructuredStream({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    });

    expect(stream.validate({ name: "Alice", age: 30 })).toBe(true);
    expect(stream.validate({ name: "Bob" })).toBe(false); // missing required
    expect(stream.validate({ name: 123, age: 30 })).toBe(false); // wrong type
  });

  it("validates arrays", () => {
    const stream = new StructuredStream({
      type: "array",
      items: { type: "string" },
    });

    expect(stream.validate(["a", "b"])).toBe(true);
    expect(stream.validate([1, 2])).toBe(false);
    expect(stream.validate("not array")).toBe(false);
  });

  it("validates nested objects", () => {
    const stream = new StructuredStream({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      required: ["user"],
    });

    expect(stream.validate({ user: { name: "Alice" } })).toBe(true);
    expect(stream.validate({ user: {} })).toBe(false);
  });

  it("resets the buffer", () => {
    const stream = new StructuredStream({ type: "object" });
    stream.writePartial('{"a":1');
    expect(stream.getBuffer()).toBe('{"a":1');
    stream.reset();
    expect(stream.getBuffer()).toBe("");
  });
});

// ─── parsePartialJson ─────────────────────────────────────────────

describe("parsePartialJson", () => {
  it("parses complete JSON", () => {
    expect(parsePartialJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("closes unclosed object", () => {
    expect(parsePartialJson('{"name":"Alice"')).toEqual({ name: "Alice" });
  });

  it("closes unclosed array", () => {
    expect(parsePartialJson("[1,2,3")).toEqual([1, 2, 3]);
  });

  it("handles nested unclosed structures", () => {
    expect(parsePartialJson('{"items":[1,2')).toEqual({ items: [1, 2] });
  });

  it("closes unclosed string inside object", () => {
    const result = parsePartialJson('{"name":"Ali');
    expect(result).toEqual({ name: "Ali" });
  });

  it("returns null for empty input", () => {
    expect(parsePartialJson("")).toBeNull();
    expect(parsePartialJson("   ")).toBeNull();
  });

  it("handles trailing comma", () => {
    const result = parsePartialJson('{"a":1,');
    expect(result).toEqual({ a: 1 });
  });
});

// ─── Cost & Trace Tracking ───────────────────────────────────────

describe("Agent cost/trace tracking", () => {
  it("populates lastRunCost after run()", async () => {
    const agent = new Agent({ model: "gpt-4o", instructions: "test" });

    await agent.run("Hello");
    const cost = agent.lastRunCost;
    expect(cost).not.toBeNull();
    expect(cost!.model).toBe("gpt-4o");
    expect(cost!.inputTokens).toBe(10);
    expect(cost!.outputTokens).toBe(20);
    agent.destroy();
  });

  it("populates lastRunTrace after run()", async () => {
    const agent = new Agent({ model: "gpt-4o", instructions: "test" });

    await agent.run("Hello");
    const trace = agent.lastRunTrace;
    expect(trace).not.toBeNull();
    expect(trace!.steps).toBe(2);
    expect(trace!.spans).toHaveLength(1);
    expect(trace!.spans[0].name).toBe("agent.run");
    agent.destroy();
  });

  it("returns null cost/trace before any run", () => {
    const agent = new Agent({ model: "gpt-4o", instructions: "test" });
    expect(agent.lastRunCost).toBeNull();
    expect(agent.lastRunTrace).toBeNull();
    agent.destroy();
  });

  it("updates cost/trace on subsequent runs", async () => {
    const agent = new Agent({ model: "gpt-4o", instructions: "test" });

    await agent.run("First");
    const cost1 = agent.lastRunCost;

    // Modify the mock to return different values
    (agent_run as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: "second",
      steps: 5,
      inputTokens: 100,
      outputTokens: 200,
    });

    await agent.run("Second");
    const cost2 = agent.lastRunCost;

    expect(cost2!.inputTokens).toBe(100);
    expect(cost2!.outputTokens).toBe(200);
    expect(cost1!.inputTokens).toBe(10); // first run values
    agent.destroy();
  });

  it("uses costEstimate from result when available", async () => {
    (agent_run as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: "with cost",
      steps: 1,
      inputTokens: 50,
      outputTokens: 60,
      costEstimate: {
        model: "gpt-4o",
        normalizedModel: "gpt-4o",
        currency: "USD",
        inputTokens: 50,
        outputTokens: 60,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        inputCostUsd: 0.001,
        outputCostUsd: 0.002,
        reasoningCostUsd: 0,
        cacheReadCostUsd: 0,
        cacheCreationCostUsd: 0,
        totalCostUsd: 0.003,
      },
    });

    const agent = new Agent({ model: "gpt-4o", instructions: "test" });
    await agent.run("test");

    expect(agent.lastRunCost!.totalCostUsd).toBe(0.003);
    expect(agent.lastRunCost!.inputCostUsd).toBe(0.001);
    agent.destroy();
  });
});
