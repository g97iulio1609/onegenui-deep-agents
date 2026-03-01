<div align="center">

# 🔮 gauss-ts

**The AI Agent SDK for TypeScript — powered by Rust**

[![CI](https://github.com/giulio-leone/gauss/actions/workflows/ci.yml/badge.svg)](https://github.com/giulio-leone/gauss/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/gauss-ts.svg)](https://www.npmjs.com/package/gauss-ts)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Multi-provider • Teams • Tools • MCP • Graphs • Workflows • Memory • RAG**

</div>

---

## Quick Start

```bash
npm install gauss-ts
```

### One-liner

```typescript
import { gauss } from "gauss-ts";

const answer = await gauss("Explain quantum computing in 3 sentences");
```

Auto-detects your API key from environment variables. That's it.

### Full control

```typescript
import { Agent, OPENAI_DEFAULT } from "gauss-ts";

const agent = new Agent({
  name: "assistant",
  model: OPENAI_DEFAULT, // "gpt-5.2"
  instructions: "You are a helpful assistant.",
});

const result = await agent.run("What is quantum computing?");
console.log(result.text);
```

---

## Features

### 🤖 Agents

```typescript
import { Agent, OPENAI_DEFAULT } from "gauss-ts";

const agent = new Agent({
  name: "researcher",
  model: OPENAI_DEFAULT, // "gpt-5.2"
  instructions: "You are a research assistant.",
  temperature: 0.7,
  maxSteps: 5,
  tools: [searchTool, calculateTool],
});

// Run
const result = await agent.run("Find the population of Tokyo");
console.log(result.text);
console.log(`Steps: ${result.steps}, Tokens: ${result.inputTokens + result.outputTokens}`);

// Stream
for await (const event of agent.streamIter("Tell me a story")) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
}
```

### 🛠️ Tools

```typescript
const weatherTool = {
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name" },
    },
    required: ["city"],
  },
  execute: async (args: { city: string }) => {
    return { temperature: 22, condition: "sunny" };
  },
};

const agent = new Agent({
  name: "weather-bot",
  model: OPENAI_DEFAULT,
  tools: [weatherTool],
});
```

### 👥 Teams

```typescript
import { Agent, Team } from "gauss-ts";

const team = new Team({
  name: "research-team",
  agents: [
    new Agent({ name: "researcher", model: "gpt-5.2", instructions: "Research topics deeply." }),
    new Agent({ name: "writer", model: "claude-sonnet-4-20250514", instructions: "Write clear summaries." }),
    new Agent({ name: "critic", model: "gemini-2.5-flash", instructions: "Review and critique." }),
  ],
  strategy: "round-robin",
});

const result = await team.run("Analyze the impact of AI on healthcare");
```

### 📊 Graph Pipelines

```typescript
import { Agent, Graph } from "gauss-ts";

const researcher = new Agent({ name: "researcher", instructions: "Research thoroughly" });
const writer = new Agent({ name: "writer", instructions: "Write clearly" });

const pipeline = new Graph()
  .addNode("research", researcher)
  .addNode("write", writer)
  .addEdge("research", "write");

const result = await pipeline.run("Explain quantum computing");
```

### 🔄 Workflows

```typescript
import { Agent, Workflow } from "gauss-ts";

const planner = new Agent({ name: "planner" });
const executor = new Agent({ name: "executor" });

const wf = new Workflow()
  .addStep("plan", planner)
  .addStep("execute", executor)
  .addDependency("execute", "plan");

const result = await wf.run("Build a REST API");
```

### 🌐 Multi-Agent Network

```typescript
import { Agent, Network } from "gauss-ts";

const analyst = new Agent({ name: "analyst" });
const coder = new Agent({ name: "coder" });

const net = new Network()
  .addAgent(analyst)
  .addAgent(coder)
  .setSupervisor("analyst");

const result = await net.delegate("coder", "Implement a sorting algorithm");
```

### 🧠 Memory

```typescript
import { Agent, Memory } from "gauss-ts";

const memory = new Memory();
const agent = new Agent({
  name: "assistant",
  model: OPENAI_DEFAULT,
  memory,
});

// Memory persists across conversations
await agent.run("My name is Alice and I love hiking.");
const result = await agent.run("What do you know about me?");
// → "You're Alice, and you enjoy hiking!"
```

### 📚 RAG / Vector Store

```typescript
import { VectorStore } from "gauss-ts";

const store = new VectorStore();
await store.add("TypeScript is a typed superset of JavaScript.");
await store.add("Rust is a systems programming language.");

const results = await store.search("What is TypeScript?");
```

### 🔗 MCP Server

```typescript
import { McpServer } from "gauss-ts";

const server = new McpServer("my-tools", "1.0.0");

server.addTool({
  name: "calculate",
  description: "Evaluate a math expression",
  parameters: { type: "object", properties: { expr: { type: "string" } } },
  execute: async ({ expr }) => ({ result: eval(expr) }),
});

const response = await server.handle(requestMessage);
```

### 🎯 Structured Output

```typescript
import { Agent, structured } from "gauss-ts";

const agent = new Agent({ model: OPENAI_DEFAULT });

const { data } = await structured(agent, "List 3 programming languages", {
  schema: {
    type: "object",
    properties: {
      languages: { type: "array", items: { type: "string" } },
    },
    required: ["languages"],
  },
  maxParseRetries: 2,
});

console.log(data.languages); // ["TypeScript", "Rust", "Python"]
```

### 💭 Reasoning

```typescript
import { Agent, OPENAI_REASONING, ANTHROPIC_PREMIUM } from "gauss-ts";

// OpenAI reasoning models (o4-mini)
const reasoner = new Agent({
  name: "solver",
  model: OPENAI_REASONING,
  reasoningEffort: "high",
});

// Anthropic extended thinking
const thinker = new Agent({
  name: "analyst",
  model: ANTHROPIC_PREMIUM,
  thinkingBudget: 10000,
});

const result = await thinker.run("Analyze this complex problem...");
console.log(result.thinking); // Internal reasoning process
```

### 📝 Prompt Templates

```typescript
import { template, summarize, translate, codeReview } from "gauss-ts";

// Custom template
const greet = template("Hello {{name}}, you are a {{role}}.");
console.log(greet({ name: "Alice", role: "developer" }));

// Built-in templates
const prompt = summarize({ format: "article", style: "bullet points", text: "..." });
const translated = translate({ language: "French", text: "Hello world" });
const review = codeReview({ language: "typescript", code: "const x = 1;" });
```

### ⚡ Batch Processing

```typescript
import { batch } from "gauss-ts";

const results = await batch(
  ["Translate: Hello", "Translate: World", "Translate: Goodbye"],
  { concurrency: 2, provider: "openai" },
);
results.forEach((r) => console.log(r.result?.text ?? r.error?.message));
```

### 🔁 Retry with Backoff

```typescript
import { withRetry, retryable } from "gauss-ts";

const data = await withRetry(() => agent.run("Summarize this"), {
  maxRetries: 3,
  backoff: "exponential", // "fixed" | "linear" | "exponential"
  baseDelayMs: 1000,
  jitter: 0.1,
  onRetry: (err, attempt, delay) => console.log(`Retry ${attempt} in ${delay}ms`),
});

// Or wrap an agent
const resilientRun = retryable(agent, { maxRetries: 5 });
const result = await resilientRun("Hello");
```

### 🛡️ Resilience

```typescript
import { createFallbackProvider, createCircuitBreaker, createResilientAgent } from "gauss-ts";

const fallback = createFallbackProvider([
  { provider: "openai", model: "gpt-5.2" },
  { provider: "anthropic", model: "claude-sonnet-4-20250514" },
]);

const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000 });
const agent = createResilientAgent({ fallback, circuitBreaker: breaker });
```

### 🔀 Pipeline & Async Helpers

```typescript
import { pipe, mapAsync, filterAsync, reduceAsync, compose } from "gauss-ts";

const result = await pipe(
  "Explain AI",
  (prompt) => agent.run(prompt),
  (result) => result.text.toUpperCase(),
);

const descriptions = await mapAsync(
  ["apple", "banana", "cherry"],
  (fruit) => agent.run(`Describe ${fruit}`),
  { concurrency: 2 },
);
```

---

## 📐 Model Constants

Import model constants as the single source of truth:

```typescript
import {
  // OpenAI
  OPENAI_DEFAULT,      // "gpt-5.2"
  OPENAI_FAST,         // "gpt-4.1"
  OPENAI_REASONING,    // "o4-mini"
  OPENAI_IMAGE,        // "gpt-image-1"

  // Anthropic
  ANTHROPIC_DEFAULT,   // "claude-sonnet-4-20250514"
  ANTHROPIC_PREMIUM,   // "claude-opus-4-20250414"
  ANTHROPIC_FAST,      // "claude-haiku-4-20250414"

  // Google
  GOOGLE_DEFAULT,      // "gemini-2.5-flash"
  GOOGLE_PREMIUM,      // "gemini-2.5-pro"
  GOOGLE_IMAGE,        // "gemini-2.0-flash"

  // OpenRouter
  OPENROUTER_DEFAULT,  // "openai/gpt-5.2"

  // DeepSeek
  DEEPSEEK_DEFAULT,    // "deepseek-chat"
  DEEPSEEK_REASONING,  // "deepseek-reasoner"

  // Helpers
  PROVIDER_DEFAULTS,   // Record<string, string>
  defaultModel,        // (provider: string) => string
} from "gauss-ts";
```

---

## 🌐 Providers

| Provider | Env Variable | Default Model |
|----------|-------------|---------------|
| OpenAI | `OPENAI_API_KEY` | `gpt-5.2` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Google | `GOOGLE_API_KEY` | `gemini-2.5-flash` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| Ollama | — (local) | `llama3.2` |
| OpenRouter | `OPENROUTER_API_KEY` | `openai/gpt-5.2` |

Set one environment variable and Gauss auto-detects the provider:

```bash
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
# or
export GOOGLE_API_KEY=AIza...
```

---

## 🧩 All Features

| Feature | Module | Description |
|---------|--------|-------------|
| **Agent** | `Agent`, `gauss()` | LLM agent with tools, structured output, streaming |
| **Streaming** | `AgentStream` | Async iterable streaming with `for await` |
| **Batch** | `batch()` | Parallel prompt execution with concurrency control |
| **Graph** | `Graph` | DAG-based multi-agent pipeline |
| **Workflow** | `Workflow` | Step-based execution with dependencies |
| **Team** | `Team` | Multi-agent team with strategy (round-robin, etc.) |
| **Network** | `Network` | Multi-agent delegation with supervisor |
| **Memory** | `Memory` | Persistent conversation memory |
| **VectorStore** | `VectorStore` | Embedding storage and semantic search (RAG) |
| **MCP** | `McpServer` | Model Context Protocol server |
| **Middleware** | `MiddlewareChain` | Request/response processing pipeline |
| **Guardrails** | `GuardrailChain` | Content moderation, PII, token limits, regex |
| **Retry** | `withRetry`, `retryable` | Exponential/linear/fixed backoff with jitter |
| **Resilience** | `createResilientAgent` | Fallback providers + circuit breaker |
| **Structured** | `structured()` | Typed JSON extraction with auto-retry |
| **Templates** | `template()` | Composable prompt templates with built-ins |
| **Pipeline** | `pipe`, `mapAsync`, `compose` | Async data flow composition |
| **Evaluation** | `EvalRunner` | Agent quality scoring with datasets |
| **Telemetry** | `Telemetry` | Spans, metrics, and export |
| **Approval** | `ApprovalManager` | Human-in-the-loop approval flow |
| **Checkpoint** | `CheckpointStore` | Save/restore agent state |
| **Tokens** | `countTokens` | Token counting and context window info |
| **Plugins** | `PluginRegistry` | Extensible plugin system |
| **Config** | `parseAgentConfig` | JSON config parsing with env resolution |
| **A2A** | `A2aClient` | Agent-to-Agent protocol client |
| **Tool Registry** | `ToolRegistry` | Searchable tool catalog with examples |
| **Spec Parsers** | `AgentSpec`, `SkillSpec` | AGENTS.MD & SKILL.MD discovery and parsing |

---

## 🏗️ Architecture

Gauss-TS is a thin SDK wrapping **[gauss-core](https://github.com/giulio-leone/gauss-core)** (Rust) via NAPI bindings. All heavy lifting — agent loops, tool execution, middleware, graph/workflow orchestration — runs at native speed in Rust.

```
TypeScript SDK (30+ modules)
       │
       ▼
  NAPI Bindings (80+ functions)
       │
       ▼
  gauss-core (Rust engine)
```

---

## 📁 Examples

See the [`examples/`](examples/) directory for **23 complete examples** covering every feature:

| # | Example | Feature |
|---|---------|---------|
| 01 | Basic Agent | Agent creation, run, stream |
| 02 | Planning Agent | Multi-step planning |
| 03 | Sub-agent Orchestration | Agent delegation |
| 04 | MCP Integration | Model Context Protocol |
| 05 | Persistent Memory | Conversation memory |
| 06 | Full-Featured | All features combined |
| 07 | Plugin System | Custom plugins |
| 08 | A2A Server | Agent-to-Agent protocol |
| 09 | CLI & REST | HTTP + CLI interfaces |
| 10 | Team Coordination | Multi-agent teams |
| 11 | Voice Pipeline | Audio/voice processing |
| 12 | Workflow DSL | Declarative workflows |
| 13 | Multimodal Vision | Image understanding |
| 14 | Video Processing | Video analysis |
| 15 | Universal Provider | Cross-provider usage |
| 16 | LLM Recording | Record & replay |
| 17 | Zero Config | Auto-detect everything |
| 18 | Tool Registry | Searchable tools |
| 19 | Graph Pipeline | DAG pipelines |
| 20 | Network Delegation | Supervisor networks |
| 21 | Structured Output | JSON extraction |
| 22 | DX Utilities | Developer experience helpers |
| 23 | Reasoning | o4-mini, extended thinking |

---

## 🔗 Ecosystem

| Package | Language | Description |
|---------|----------|-------------|
| [`gauss-core`](https://github.com/giulio-leone/gauss-core) | Rust | Core engine — NAPI + PyO3 + WASM |
| [`gauss-ts`](https://github.com/giulio-leone/gauss) | TypeScript | This SDK (NAPI bindings) |
| [`gauss-py`](https://github.com/giulio-leone/gauss-py) | Python | Python SDK (PyO3 bindings) |

## API Reference

```bash
npm run docs
```

Generates HTML docs in `docs/api/` from JSDoc comments in the source.

## License

MIT © [Giulio Leone](https://github.com/giulio-leone)
