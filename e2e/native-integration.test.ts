/**
 * E2E Integration Tests — gauss-ts → gauss-napi → gauss-core (Rust)
 *
 * These tests exercise the REAL native Rust bindings without mocking.
 * They cover all operations that do NOT require external API calls.
 * LLM-dependent operations use a local mock HTTP server.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";

import {
  Memory,
  VectorStore,
  MiddlewareChain,
  PluginRegistry,
  GuardrailChain,
  ToolValidator,
  Telemetry,
  CheckpointStore,
  ApprovalManager,
  EvalRunner,
  Agent,
  batch,
  gauss,
  countTokens,
  countTokensForModel,
  countMessageTokens,
  getContextWindowSize,
  parsePartialJson,
  withRetry,
  template,
  pipe,
  mapAsync,
  compose,
} from "../src/sdk/index.js";

// ---------------------------------------------------------------------------
// Mock OpenAI-compatible HTTP server
// ---------------------------------------------------------------------------
let mockServer: Server;
let mockPort: number;

function createMockOpenAIServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });

        if (req.url?.includes("/chat/completions")) {
          res.end(
            JSON.stringify({
              id: "mock-1",
              object: "chat.completion",
              choices: [{
                index: 0,
                message: { role: "assistant", content: "Hello from Rust via gauss-core!" },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            })
          );
        } else {
          res.end(JSON.stringify({ error: "Unknown endpoint" }));
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function agentConfig() {
  return {
    provider: "openai" as const,
    model: "gpt-4",
    providerOptions: {
      apiKey: "sk-mock-test",
      baseUrl: `http://127.0.0.1:${mockPort}/v1`,
    },
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("E2E: Native Integration (gauss-ts → NAPI → Rust)", () => {
  beforeAll(async () => {
    const result = await createMockOpenAIServer();
    mockServer = result.server;
    mockPort = result.port;
  });

  afterAll(() => {
    mockServer?.close();
  });

  // =========================================================================
  // Token Operations (pure Rust, no API calls)
  // =========================================================================
  describe("Tokens (pure Rust)", () => {
    it("counts tokens for a string", () => {
      const count = countTokens("Hello, world!");
      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe("number");
    });

    it("counts tokens for model", () => {
      const count = countTokensForModel("gpt-4", "Hello, world!");
      expect(count).toBeGreaterThan(0);
    });

    it("counts message tokens", () => {
      const messages = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello!" },
      ];
      const count = countMessageTokens(messages);
      expect(count).toBeGreaterThan(0);
    });

    it("returns context window size", () => {
      const size = getContextWindowSize("gpt-4");
      expect(size).toBeGreaterThan(0);
    });

    it("handles empty string", () => {
      expect(countTokens("")).toBe(0);
    });

    it("handles long string", () => {
      expect(countTokens("word ".repeat(10000))).toBeGreaterThan(5000);
    });
  });

  // =========================================================================
  // parsePartialJson (pure Rust)
  // =========================================================================
  describe("parsePartialJson (pure Rust)", () => {
    it("parses complete JSON", () => {
      expect(parsePartialJson('{"key": "value"}')).toBeTruthy();
    });

    it("parses partial JSON", () => {
      expect(parsePartialJson('{"key": "val')).toBeTruthy();
    });
  });

  // =========================================================================
  // Memory (Rust handle lifecycle)
  // =========================================================================
  describe("Memory (Rust lifecycle)", () => {
    it("creates, stores, recalls, and destroys", async () => {
      const mem = new Memory();
      await mem.store("conversation", "Hello!");
      await mem.store("conversation", "Hi there!");
      const history = await mem.recall();
      expect(history).toBeTruthy();
      mem.destroy();
    });

    it("clears memory", async () => {
      const mem = new Memory();
      await mem.store("conversation", "Test message");
      await mem.clear();
      mem.destroy();
    });

    it("reports stats", async () => {
      const mem = new Memory();
      await mem.store("conversation", "Message 1");
      const stats = await mem.stats();
      expect(stats).toBeTruthy();
      mem.destroy();
    });

    it("prevents use after destroy", async () => {
      const mem = new Memory();
      mem.destroy();
      await expect(mem.store("message", "test")).rejects.toThrow("destroyed");
    });
  });

  // =========================================================================
  // VectorStore (Rust handle lifecycle)
  // =========================================================================
  describe("VectorStore (Rust lifecycle)", () => {
    it("upserts and searches", async () => {
      const store = new VectorStore();
      await store.upsert([
        { id: "c1", documentId: "doc1", content: "Machine learning is great", index: 0, embedding: [1, 0, 0] },
        { id: "c2", documentId: "doc1", content: "Cooking recipes", index: 1, embedding: [0, 1, 0] },
      ]);
      const results = await store.search([1, 0, 0], 1);
      expect(results).toBeTruthy();
      store.destroy();
    });

    it("cosine similarity", () => {
      const sim = VectorStore.cosineSimilarity([1, 0, 0], [1, 0, 0]);
      expect(sim).toBeCloseTo(1.0, 2);
    });

    it("prevents use after destroy", async () => {
      const store = new VectorStore();
      store.destroy();
      await expect(store.search([1, 0, 0], 1)).rejects.toThrow("destroyed");
    });
  });

  // =========================================================================
  // Telemetry (Rust handle lifecycle)
  // =========================================================================
  describe("Telemetry (Rust lifecycle)", () => {
    it("records and exports spans", () => {
      const tel = new Telemetry();
      tel.recordSpan("test-operation", 150);
      const spans = tel.exportSpans();
      expect(spans).toBeTruthy();
      tel.destroy();
    });

    it("exports metrics", () => {
      const tel = new Telemetry();
      tel.recordSpan("op1", 100);
      tel.recordSpan("op2", 200);
      const metrics = tel.exportMetrics();
      expect(metrics).toBeTruthy();
      tel.destroy();
    });

    it("clears data", () => {
      const tel = new Telemetry();
      tel.recordSpan("op", 50);
      tel.clear();
      tel.destroy();
    });
  });

  // =========================================================================
  // MiddlewareChain (Rust handle lifecycle)
  // =========================================================================
  describe("MiddlewareChain (Rust lifecycle)", () => {
    it("adds logging and caching middleware", () => {
      const chain = new MiddlewareChain();
      chain.useLogging();
      chain.useCaching(60000);
      chain.destroy();
    });
  });

  // =========================================================================
  // PluginRegistry (Rust handle lifecycle)
  // =========================================================================
  describe("PluginRegistry (Rust lifecycle)", () => {
    it("registers plugins and lists them", () => {
      const registry = new PluginRegistry();
      registry.addMemory();
      registry.addTelemetry();
      const plugins = registry.list();
      expect(plugins).toBeTruthy();
      registry.destroy();
    });

    it("emits custom event", () => {
      const registry = new PluginRegistry();
      registry.addTelemetry();
      registry.emit({ type: "custom", name: "test-event", data: { key: "value" } });
      registry.destroy();
    });
  });

  // =========================================================================
  // GuardrailChain (Rust handle lifecycle)
  // =========================================================================
  describe("GuardrailChain (Rust lifecycle)", () => {
    it("adds guardrails and lists them", () => {
      const chain = new GuardrailChain();
      chain.addTokenLimit(1000);
      chain.addRegexFilter(["\\b(secret|password)\\b"]);
      chain.addContentModeration(["violence"], ["mild_language"]);
      const list = chain.list();
      expect(list).toBeTruthy();
      chain.destroy();
    });
  });

  // =========================================================================
  // ToolValidator (Rust handle lifecycle)
  // =========================================================================
  describe("ToolValidator (Rust lifecycle)", () => {
    it("validates tool calls", () => {
      const validator = new ToolValidator();
      const schema = JSON.stringify({
        name: "search",
        parameters: { type: "object", properties: { query: { type: "string" } } },
      });
      const result = validator.validate(schema, JSON.stringify({ query: "test" }));
      expect(result).toBeTruthy();
      validator.destroy();
    });
  });

  // =========================================================================
  // CheckpointStore (Rust handle lifecycle)
  // =========================================================================
  describe("CheckpointStore (Rust lifecycle)", () => {
    it("saves and loads checkpoints", async () => {
      const store = new CheckpointStore();
      const checkpoint = {
        id: "cp-1",
        session_id: "agent-1",
        step_index: 0,
        messages: [],
        pending_approval: null,
        metadata: { state: "running" },
        created_at: Date.now(),
        schema_version: 1,
      };
      await store.save(checkpoint);
      const loaded = await store.load("cp-1");
      expect(loaded).toBeTruthy();
      store.destroy();
    });

    it("loads latest checkpoint", async () => {
      const store = new CheckpointStore();
      await store.save({
        id: "cp-a",
        session_id: "agent-1",
        step_index: 0,
        messages: [],
        pending_approval: null,
        metadata: { state: "a" },
        created_at: Date.now() - 1000,
        schema_version: 1,
      });
      await store.save({
        id: "cp-b",
        session_id: "agent-1",
        step_index: 1,
        messages: [],
        pending_approval: null,
        metadata: { state: "b" },
        created_at: Date.now(),
        schema_version: 1,
      });
      const latest = await store.loadLatest("agent-1");
      expect(latest).toBeTruthy();
      store.destroy();
    });
  });

  // =========================================================================
  // ApprovalManager (Rust handle lifecycle)
  // =========================================================================
  describe("ApprovalManager (Rust lifecycle)", () => {
    it("manages approval workflow", () => {
      const mgr = new ApprovalManager();
      const requestId = mgr.request("delete_file", { path: "/tmp/data" }, "session-1");
      expect(requestId).toBeTruthy();
      const pending = mgr.listPending();
      expect(pending).toBeTruthy();
      mgr.approve(requestId);
      mgr.destroy();
    });
  });

  // =========================================================================
  // EvalRunner (Rust handle lifecycle)
  // =========================================================================
  describe("EvalRunner (Rust lifecycle)", () => {
    it("creates eval runner and adds scorers", () => {
      const runner = new EvalRunner();
      runner.addScorer("exact_match", "{}");
      runner.destroy();
    });
  });

  // =========================================================================
  // Agent → Provider → Mock Server (full E2E)
  // =========================================================================
  describe("Agent E2E (SDK → NAPI → Rust → Mock Server)", () => {
    it("completes a basic agent run", async () => {
      const agent = new Agent({
        ...agentConfig(),
        instructions: "You are a helpful assistant.",
      });

      const result = await agent.run("Say hello");
      expect(result.text).toContain("Hello from Rust");
      expect(result.inputTokens + result.outputTokens).toBeGreaterThan(0);

      agent.destroy();
    });

    it("runs with gauss() shorthand", async () => {
      const result = await gauss("Say hello", agentConfig());
      expect(result).toContain("Hello from Rust");
    });

    it("handles batch operations", async () => {
      const results = await batch(
        ["Hello 1", "Hello 2", "Hello 3"],
        { ...agentConfig(), concurrency: 2 }
      );

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.result).toBeTruthy();
        expect(r.result?.text).toContain("Hello from Rust");
      }
    });

    it("exposes agent metadata", () => {
      const agent = new Agent({
        ...agentConfig(),
        name: "test-agent",
        instructions: "Be helpful",
      });
      expect(agent.name).toBe("test-agent");
      expect(agent.provider).toBe("openai");
      expect(agent.model).toBe("gpt-4");
      expect(agent.instructions).toBe("Be helpful");
      agent.destroy();
    });
  });

  // =========================================================================
  // DX Utilities
  // =========================================================================
  describe("DX Utilities", () => {
    it("template renders variables", () => {
      const tmpl = template("Hello, {{name}}! You are {{role}}.");
      const result = tmpl({ name: "Gauss", role: "an AI" });
      expect(result).toBe("Hello, Gauss! You are an AI.");
    });

    it("template → gauss pipeline", async () => {
      const tmpl = template("Summarize: {{text}}");
      const prompt = tmpl({ text: "Rust is fast and safe" });
      const result = await gauss(prompt, agentConfig());
      expect(result).toBeTruthy();
    });

    it("withRetry succeeds on first try", async () => {
      let callCount = 0;
      const result = await withRetry(
        async () => {
          callCount++;
          return gauss("Hello", agentConfig());
        },
        { maxRetries: 3 }
      );
      expect(result).toBeTruthy();
      expect(callCount).toBe(1);
    });

    it("pipe chains transformations", async () => {
      const result = await pipe(
        "Hello from pipe",
        async (text: string) => text.toUpperCase(),
        async (text: string) => `[${text}]`
      );
      expect(result).toBe("[HELLO FROM PIPE]");
    });

    it("mapAsync processes arrays", async () => {
      const results = await mapAsync([1, 2, 3, 4, 5], async (n) => n * 2, 2);
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("compose creates reusable pipelines", async () => {
      const double = async (n: number) => n * 2;
      const addTen = async (n: number) => n + 10;
      const transform = compose(double, addTen);
      expect(await transform(5)).toBe(20);
    });
  });
});
