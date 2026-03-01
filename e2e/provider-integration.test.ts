/**
 * Real Provider Integration Tests — gauss-ts
 *
 * Run with actual API keys:
 *   OPENAI_API_KEY=sk-... npx vitest run e2e/provider-integration.test.ts
 *   OPENROUTER_API_KEY=sk-... npx vitest run e2e/provider-integration.test.ts
 *
 * These tests call real LLM APIs and verify the full gauss pipeline works end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ─── Environment Detection ──────────────────────────────────────────

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const hasOpenAI = !!OPENAI_KEY;
const hasOpenRouter = !!OPENROUTER_KEY;

function skipIf(condition: boolean, reason: string) {
  if (condition) {
    it.skip(reason, () => {});
    return true;
  }
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────

interface TestResult {
  provider: string;
  model: string;
  test: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  output?: string;
}

const results: TestResult[] = [];

function record(r: TestResult) {
  results.push(r);
}

// ─── OpenAI Tests ───────────────────────────────────────────────────

describe.skipIf(!hasOpenAI)("OpenAI Provider", () => {
  let Agent: typeof import("../src/sdk/agent.js").Agent;

  beforeAll(async () => {
    ({ Agent } = await import("../src/sdk/agent.js"));
  });

  it("simple completion", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-openai",
      provider: "openai",
      model: "gpt-4o-mini",
      providerOptions: { apiKey: OPENAI_KEY },
      instructions: "You are a helpful assistant. Reply concisely.",
    });

    try {
      const result = await agent.run("What is 2 + 2? Reply with just the number.");
      const latency = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text).toContain("4");

      record({
        provider: "openai",
        model: "gpt-4o-mini",
        test: "simple-completion",
        success: true,
        latencyMs: latency,
        output: result.text,
      });
    } finally {
      agent.destroy();
    }
  }, 60000);

  it("system instructions are followed", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-instructions",
      provider: "openai",
      model: "gpt-4o-mini",
      providerOptions: { apiKey: OPENAI_KEY },
      instructions: "You are a pirate. Always start your response with 'Arrr!'",
    });

    try {
      const result = await agent.run("Say hello");
      const latency = Date.now() - start;

      expect(result.text.toLowerCase()).toContain("arrr");

      record({
        provider: "openai",
        model: "gpt-4o-mini",
        test: "system-instructions",
        success: true,
        latencyMs: latency,
        output: result.text,
      });
    } finally {
      agent.destroy();
    }
  }, 30000);

  it("tool calling with function execution", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-tools",
      provider: "openai",
      model: "gpt-4o-mini",
      providerOptions: { apiKey: OPENAI_KEY },
      instructions: "You have access to a calculator. Use the calculate tool to solve math.",
      tools: [
        {
          name: "calculate",
          description: "Calculate a mathematical expression",
          parameters: {
            type: "object",
            properties: {
              expression: { type: "string", description: "Math expression to evaluate" },
            },
            required: ["expression"],
          },
        },
      ],
    });

    try {
      const result = await agent.runWithTools(
        "What is 15 * 23?",
        async (toolName, args) => {
          expect(toolName).toBe("calculate");
          const expr = JSON.parse(args).expression;
          return JSON.stringify({ result: eval(expr) });
        }
      );
      const latency = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.text).toContain("345");

      record({
        provider: "openai",
        model: "gpt-4o-mini",
        test: "tool-calling",
        success: true,
        latencyMs: latency,
        output: result.text,
      });
    } finally {
      agent.destroy();
    }
  }, 60000);

  it("streaming response", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-stream",
      provider: "openai",
      model: "gpt-4o-mini",
      providerOptions: { apiKey: OPENAI_KEY },
      instructions: "You are a helpful assistant. Reply concisely.",
    });

    const events: unknown[] = [];

    try {
      const result = await agent.stream(
        "Count from 1 to 5, each on a new line.",
        (event) => events.push(event),
        async () => ""
      );
      const latency = Date.now() - start;

      expect(result).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      record({
        provider: "openai",
        model: "gpt-4o-mini",
        test: "streaming",
        success: true,
        latencyMs: latency,
        output: `${events.length} events received`,
      });
    } finally {
      agent.destroy();
    }
  }, 30000);

  it("multi-turn conversation", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-multiturn",
      provider: "openai",
      model: "gpt-4o-mini",
      providerOptions: { apiKey: OPENAI_KEY },
      instructions: "You are a helpful assistant. Be concise.",
    });

    try {
      const r1 = await agent.run("My name is Alice.");
      expect(r1.text).toBeDefined();

      const r2 = await agent.run([
        ...[{ role: "user" as const, content: "My name is Alice." }, { role: "assistant" as const, content: r1.text }],
        { role: "user" as const, content: "What is my name?" },
      ]);
      expect(r2.text.toLowerCase()).toContain("alice");
      const latency = Date.now() - start;

      record({
        provider: "openai",
        model: "gpt-4o-mini",
        test: "multi-turn",
        success: true,
        latencyMs: latency,
        output: r2.text,
      });
    } finally {
      agent.destroy();
    }
  }, 60000);

  it("generate raw (no agent loop)", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-generate",
      provider: "openai",
      model: "gpt-4o-mini",
      providerOptions: { apiKey: OPENAI_KEY },
      instructions: "You are a helpful assistant.",
    });

    try {
      const result = await agent.generate("Say 'hello world'", {
        temperature: 0,
        maxTokens: 50,
      });
      const latency = Date.now() - start;

      expect(result).toBeDefined();

      record({
        provider: "openai",
        model: "gpt-4o-mini",
        test: "generate-raw",
        success: true,
        latencyMs: latency,
        output: JSON.stringify(result).slice(0, 200),
      });
    } finally {
      agent.destroy();
    }
  }, 30000);
});

// ─── OpenRouter Tests ────────────────────────────────────────────────

describe.skipIf(!hasOpenRouter)("OpenRouter Provider", () => {
  let Agent: typeof import("../src/sdk/agent.js").Agent;

  beforeAll(async () => {
    ({ Agent } = await import("../src/sdk/agent.js"));
  });

  it("simple completion via OpenRouter", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-openrouter",
      provider: "openai",
      model: "openai/gpt-4o-mini",
      providerOptions: {
        apiKey: OPENROUTER_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      instructions: "Reply concisely.",
    });

    try {
      const result = await agent.run("What is the capital of France? One word.");
      const latency = Date.now() - start;

      expect(result.text.toLowerCase()).toContain("paris");

      record({
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        test: "simple-completion",
        success: true,
        latencyMs: latency,
        output: result.text,
      });
    } finally {
      agent.destroy();
    }
  }, 30000);

  it("Anthropic model via OpenRouter", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-openrouter-claude",
      provider: "openai",
      model: "anthropic/claude-3.5-haiku",
      providerOptions: {
        apiKey: OPENROUTER_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      instructions: "Reply concisely.",
    });

    try {
      const result = await agent.run("What is 10 + 10? Just the number.");
      const latency = Date.now() - start;

      expect(result.text).toContain("20");

      record({
        provider: "openrouter",
        model: "anthropic/claude-3.5-haiku",
        test: "claude-completion",
        success: true,
        latencyMs: latency,
        output: result.text,
      });
    } finally {
      agent.destroy();
    }
  }, 30000);

  it("tool calling via OpenRouter", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-openrouter-tools",
      provider: "openai",
      model: "openai/gpt-4o-mini",
      providerOptions: {
        apiKey: OPENROUTER_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      instructions: "Use the weather tool to answer questions about weather.",
      tools: [
        {
          name: "get_weather",
          description: "Get current weather for a city",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
            required: ["city"],
          },
        },
      ],
    });

    try {
      const result = await agent.runWithTools(
        "What's the weather in Rome?",
        async (toolName, args) => {
          expect(toolName).toBe("get_weather");
          return JSON.stringify({ temperature: 22, condition: "sunny" });
        }
      );
      const latency = Date.now() - start;

      expect(result).toBeDefined();

      record({
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        test: "tool-calling",
        success: true,
        latencyMs: latency,
        output: result.text,
      });
    } finally {
      agent.destroy();
    }
  }, 60000);

  it("streaming via OpenRouter", async () => {
    const start = Date.now();
    const agent = new Agent({
      name: "test-openrouter-stream",
      provider: "openai",
      model: "openai/gpt-4o-mini",
      providerOptions: {
        apiKey: OPENROUTER_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      instructions: "Reply concisely.",
    });

    const events: unknown[] = [];

    try {
      const result = await agent.stream(
        "List 3 colors.",
        (event) => events.push(event),
        async () => ""
      );
      const latency = Date.now() - start;

      expect(result).toBeDefined();

      record({
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        test: "streaming",
        success: true,
        latencyMs: latency,
        output: `${events.length} events`,
      });
    } finally {
      agent.destroy();
    }
  }, 30000);
});

// ─── Report ──────────────────────────────────────────────────────────

afterAll(() => {
  if (results.length === 0) return;

  console.log("\n" + "═".repeat(80));
  console.log("  GAUSS-TS PROVIDER INTEGRATION TEST REPORT");
  console.log("═".repeat(80));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  for (const r of results) {
    const status = r.success ? "✅" : "❌";
    const latency = `${r.latencyMs}ms`;
    console.log(`  ${status} [${r.provider}/${r.model}] ${r.test} — ${latency}`);
    if (r.output) console.log(`     Output: ${r.output.slice(0, 100)}`);
    if (r.error) console.log(`     Error: ${r.error}`);
  }

  console.log("─".repeat(80));
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("═".repeat(80) + "\n");
});
