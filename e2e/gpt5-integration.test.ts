/**
 * GPT-5.2 Integration Tests — Full Feature Coverage
 *
 * Run: OPENAI_API_KEY=sk-... npx vitest run e2e/gpt5-integration.test.ts
 *
 * Tests every gauss-ts feature against GPT-5.2 with minimal token usage.
 */
import { describe, it, expect, afterAll } from "vitest";
import { Agent, gauss, batch, structured, template, pipe, mapAsync, AgentStream } from "../src/sdk/index.js";
import type { AgentResult, ToolDef, StreamEvent } from "../src/sdk/index.js";

// ─── Config ─────────────────────────────────────────────────────────

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-5.2";
const hasKey = !!API_KEY;

const opts = {
  provider: "openai" as const,
  model: MODEL,
  providerOptions: { apiKey: API_KEY },
  temperature: 0,
  maxTokens: 50,
};

// ─── Report ─────────────────────────────────────────────────────────

interface TestResult {
  test: string;
  feature: string;
  success: boolean;
  latencyMs: number;
  tokens?: { input: number; output: number };
  output?: string;
  error?: string;
}

const results: TestResult[] = [];

function record(r: TestResult) { results.push(r); }
function t(fn: () => number) { return Date.now() - fn(); }

afterAll(() => {
  if (results.length === 0) return;
  const pass = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  const totalTokens = results.reduce((s, r) => s + (r.tokens?.input ?? 0) + (r.tokens?.output ?? 0), 0);

  console.log("\n" + "═".repeat(80));
  console.log("  GPT-5.2 FULL FEATURE INTEGRATION REPORT");
  console.log("═".repeat(80));

  for (const r of results) {
    const icon = r.success ? "✅" : "❌";
    const tok = r.tokens ? ` [${r.tokens.input}+${r.tokens.output} tok]` : "";
    console.log(`  ${icon} ${r.feature.padEnd(22)} ${r.test.padEnd(30)} ${r.latencyMs}ms${tok}`);
    if (r.output) console.log(`     → ${r.output.slice(0, 100)}`);
    if (r.error) console.log(`     ✖ ${r.error.slice(0, 100)}`);
  }

  console.log("─".repeat(80));
  console.log(`  Total: ${results.length} | ✅ ${pass} | ❌ ${fail} | Tokens: ${totalTokens}`);
  console.log("═".repeat(80));
});

// ─── 1. Agent: Simple Completion ────────────────────────────────────

describe.skipIf(!hasKey)("GPT-5.2 Features", () => {

  it("agent.run — simple completion", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t1", instructions: "Answer in 1 word." });
    try {
      const r = await agent.run("Capital of Italy?");
      record({
        test: "simple-completion", feature: "Agent.run",
        success: true, latencyMs: Date.now() - start,
        tokens: { input: r.inputTokens, output: r.outputTokens },
        output: r.text,
      });
      expect(r.text.toLowerCase()).toContain("rome");
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 2. System Instructions ─────────────────────────────────────

  it("agent.run — system instructions", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t2", instructions: "Reply only with JSON: {\"answer\": ...}" });
    try {
      const r = await agent.run("2+2?");
      record({
        test: "system-instructions", feature: "Agent.run",
        success: true, latencyMs: Date.now() - start,
        tokens: { input: r.inputTokens, output: r.outputTokens },
        output: r.text,
      });
      expect(r.text).toContain("{");
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 3. Tool Calling ────────────────────────────────────────────

  it("agent.runWithTools — tool calling", async () => {
    const start = Date.now();
    const calcTool: ToolDef = {
      name: "calc", description: "Evaluate math",
      parameters: { type: "object", properties: { expr: { type: "string" } }, required: ["expr"] },
    };
    const agent = new Agent({ ...opts, name: "t3", maxTokens: 100, instructions: "Use calc tool.", tools: [calcTool] });
    try {
      const r = await agent.runWithTools("7*6?", async (_name, args) => {
        const { expr } = JSON.parse(args);
        return JSON.stringify({ result: eval(expr) });
      });
      record({
        test: "tool-calling", feature: "Agent.runWithTools",
        success: true, latencyMs: Date.now() - start,
        tokens: { input: r.inputTokens, output: r.outputTokens },
        output: r.text,
      });
      expect(r.text).toContain("42");
    } finally { agent.destroy(); }
  }, 60000);

  // ─── 4. Streaming ───────────────────────────────────────────────

  it("agent.stream — streaming events", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t4", instructions: "Count 1-3." });
    const events: string[] = [];
    try {
      const r = await agent.stream("Go", (ev) => events.push(ev), async () => "");
      record({
        test: "streaming", feature: "Agent.stream",
        success: true, latencyMs: Date.now() - start,
        tokens: { input: r.inputTokens, output: r.outputTokens },
        output: `${events.length} events`,
      });
      expect(events.length).toBeGreaterThan(0);
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 5. StreamIter (async iterable) ─────────────────────────────

  it("agent.streamIter — async iterable", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t5", instructions: "Say hi." });
    const chunks: StreamEvent[] = [];
    try {
      const stream = agent.streamIter("Go", async () => "");
      for await (const ev of stream) { chunks.push(ev); }
      const finalResult = stream.result;
      record({
        test: "stream-iter", feature: "AgentStream",
        success: true, latencyMs: Date.now() - start,
        tokens: finalResult ? { input: finalResult.inputTokens, output: finalResult.outputTokens } : undefined,
        output: `${chunks.length} chunks, result: ${finalResult?.text?.slice(0, 50)}`,
      });
      expect(chunks.length).toBeGreaterThan(0);
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 6. Multi-Turn ──────────────────────────────────────────────

  it("agent.run — multi-turn memory", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t6", instructions: "Be concise." });
    try {
      const r1 = await agent.run("My pet is a cat named Luna.");
      const r2 = await agent.run([
        { role: "user" as const, content: "My pet is a cat named Luna." },
        { role: "assistant" as const, content: r1.text },
        { role: "user" as const, content: "Pet name?" },
      ]);
      record({
        test: "multi-turn", feature: "Agent.run",
        success: true, latencyMs: Date.now() - start,
        tokens: { input: r1.inputTokens + r2.inputTokens, output: r1.outputTokens + r2.outputTokens },
        output: r2.text,
      });
      expect(r2.text.toLowerCase()).toContain("luna");
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 7. Generate Raw ────────────────────────────────────────────

  it("agent.generate — raw LLM call", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t7" });
    try {
      const r = await agent.generate("Say OK", { temperature: 0, maxTokens: 5 }) as Record<string, unknown>;
      record({
        test: "generate-raw", feature: "Agent.generate",
        success: true, latencyMs: Date.now() - start,
        output: JSON.stringify(r).slice(0, 150),
      });
      expect(r).toBeDefined();
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 8. Generate With Tools ─────────────────────────────────────

  it("agent.generateWithTools — raw tool detection", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t8", instructions: "Always use the greet tool." });
    const greetTool: ToolDef = {
      name: "greet", description: "Greet someone",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    };
    try {
      const r = await agent.generateWithTools("Greet Bob", [greetTool], { temperature: 0, maxTokens: 50 }) as Record<string, unknown>;
      record({
        test: "generate-with-tools", feature: "Agent.generateWithTools",
        success: true, latencyMs: Date.now() - start,
        output: JSON.stringify(r).slice(0, 150),
      });
      expect(r).toBeDefined();
    } finally { agent.destroy(); }
  }, 30000);

  // ─── 9. gauss() One-Liner ───────────────────────────────────────

  it("gauss() — one-liner", async () => {
    const start = Date.now();
    const answer = await gauss("2+3? Number only.", opts);
    record({
      test: "one-liner", feature: "gauss()",
      success: true, latencyMs: Date.now() - start,
      output: answer,
    });
    expect(answer).toContain("5");
  }, 30000);

  // ─── 10. Structured Output ──────────────────────────────────────

  it("structured() — JSON schema extraction", async () => {
    const start = Date.now();
    const agent = new Agent({ ...opts, name: "t10", maxTokens: 100, instructions: "Output valid JSON only." });
    try {
      const r = await structured<{ name: string; age: number }>(agent, "Alice is 30.", {
        schema: {
          type: "object",
          properties: { name: { type: "string" }, age: { type: "number" } },
          required: ["name", "age"],
        },
      });
      record({
        test: "structured-output", feature: "structured()",
        success: true, latencyMs: Date.now() - start,
        output: JSON.stringify(r.data),
      });
      expect(r.data.name.toLowerCase()).toBe("alice");
      expect(r.data.age).toBe(30);
    } finally { agent.destroy(); }
  }, 60000);

  // ─── 11. Template ───────────────────────────────────────────────

  it("template() — prompt template", async () => {
    const start = Date.now();
    const t = template("Translate '{{text}}' to {{lang}}. Just the translation.");
    const prompt = t({ text: "hello", lang: "Italian" });
    const answer = await gauss(prompt, opts);
    record({
      test: "template", feature: "template()",
      success: true, latencyMs: Date.now() - start,
      output: answer,
    });
    expect(answer.toLowerCase()).toContain("ciao");
  }, 30000);

  // ─── 12. Batch ──────────────────────────────────────────────────

  it("batch() — parallel prompts", async () => {
    const start = Date.now();
    const items = await batch(
      ["1+1? Number.", "2+2? Number.", "3+3? Number."],
      { ...opts, concurrency: 3 }
    );
    const totalTokens = items.reduce((s, i) => s + (i.result?.inputTokens ?? 0) + (i.result?.outputTokens ?? 0), 0);
    record({
      test: "batch-parallel", feature: "batch()",
      success: true, latencyMs: Date.now() - start,
      tokens: { input: totalTokens, output: 0 },
      output: items.map(i => i.result?.text?.trim()).join(", "),
    });
    expect(items.every(i => i.result != null)).toBe(true);
  }, 60000);

  // ─── 13. Pipe / Pipeline ────────────────────────────────────────

  it("pipe() — sequential pipeline", async () => {
    const start = Date.now();
    const result = await pipe(
      "Rome",
      async (city: string) => {
        const a = await gauss(`Country of ${city}? One word.`, opts);
        return a.trim();
      },
      async (country: string) => {
        const a = await gauss(`Continent of ${country}? One word.`, opts);
        return a.trim();
      }
    );
    record({
      test: "pipeline", feature: "pipe()",
      success: true, latencyMs: Date.now() - start,
      output: result as string,
    });
    expect((result as string).toLowerCase()).toContain("europe");
  }, 60000);

  // ─── 14. mapAsync ───────────────────────────────────────────────

  it("mapAsync() — concurrent map", async () => {
    const start = Date.now();
    const inputs = ["dog", "cat"];
    const answers = await mapAsync(inputs, async (animal) => {
      return gauss(`${animal} sound? One word.`, opts);
    }, 2);
    record({
      test: "map-async", feature: "mapAsync()",
      success: true, latencyMs: Date.now() - start,
      output: answers.join(", "),
    });
    expect(answers.length).toBe(2);
  }, 30000);

  // ─── 15. Agent Lifecycle ────────────────────────────────────────

  it("agent lifecycle — destroy + error", async () => {
    const agent = new Agent({ ...opts, name: "t15" });
    const r = await agent.run("Hi");
    expect(r.text).toBeDefined();
    agent.destroy();
    await expect(agent.run("Fail")).rejects.toThrow();
    record({
      test: "lifecycle", feature: "Agent.destroy",
      success: true, latencyMs: 0,
      output: "destroy + post-destroy error OK",
    });
  }, 30000);

  // ─── 16. Agent properties ───────────────────────────────────────

  it("agent properties — name, instructions, handle", () => {
    const agent = new Agent({ ...opts, name: "props-test", instructions: "Test" });
    expect(agent.name).toBe("props-test");
    expect(agent.instructions).toBe("Test");
    expect(agent.handle).toBeDefined();
    agent.destroy();
    record({
      test: "properties", feature: "Agent props",
      success: true, latencyMs: 0,
      output: "name, instructions, handle OK",
    });
  });

});
