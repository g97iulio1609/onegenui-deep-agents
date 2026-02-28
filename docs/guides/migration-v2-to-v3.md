# Migration Guide: Gauss v2.x → v3.0

## Overview

Gauss v3.0 replaces the AI SDK-based TypeScript core with a Rust engine
(gauss-core) accessed via NAPI bindings. The public API surface remains
familiar but several imports, patterns, and defaults have changed.

## Prerequisites

- Node.js ≥ 18 (or Bun ≥ 1.0, Deno ≥ 1.40)
- Rust toolchain (only if building from source)
- `@gauss-ai/core` npm package (pre-built NAPI binary)

## Step 1 — Update Dependencies

```bash
# Remove old AI SDK peer dependencies
npm uninstall @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google ai

# Install Gauss v3
npm install gauss-ai@3
npm install @gauss-ai/core  # native Rust backend (recommended)
# OR
npm install @gauss-ai/wasm  # universal WASM fallback
```

## Step 2 — Import Changes

### Provider Imports

```diff
- import { openai } from "@ai-sdk/openai";
- import { anthropic } from "@ai-sdk/anthropic";
+ import { gauss } from "gauss-ai/providers";
+
+ // Unified provider factory
+ const model = gauss("openai", "gpt-4o");
+ const claude = gauss("anthropic", "claude-4-sonnet");
+ const gemini = gauss("google", "gemini-2.0-flash");
```

### Core Function Imports

```diff
- import { generateText, streamText } from "ai";
+ import { generateText, streamText } from "gauss-ai";
```

### Agent API

```diff
- import { Agent } from "gauss-ai";
- const agent = new Agent({ model, tools, ... });
- const result = await agent.execute(prompt);
+ import { Agent } from "gauss-ai";
+ const agent = Agent({ name: "my-agent", model, instructions: "...", tools });
+ const result = await agent.run(prompt);
+ // result.text, result.steps, result.usage
```

### Tool Definition

```diff
- import { tool } from "ai";
- const myTool = tool({
-   description: "...",
-   parameters: z.object({ ... }),
-   execute: async (args) => { ... },
- });
+ import { tool } from "gauss-ai";
+ const myTool = tool({
+   description: "...",
+   parameters: z.object({ ... }),  // same Zod schema
+   execute: async (args) => { ... },
+ });
```

Tool definitions are mostly unchanged — Zod schemas are automatically
converted to JSON Schema via the built-in `zodToJsonSchema()` converter.

## Step 3 — API Changes

### generateText / streamText

```diff
  const result = await generateText({
    model,
-   prompt: "Hello",
+   prompt: "Hello",          // unchanged
+   system: "You are helpful", // system prompt now a top-level option
    tools,
    maxSteps: 10,
  });

- result.text
+ result.text                  // unchanged
+ result.usage.inputTokens     // was result.usage.promptTokens
+ result.usage.outputTokens    // was result.usage.completionTokens
```

### Structured Output

```diff
  import { z } from "zod";

  const result = await generateText({
    model,
    prompt: "Extract data",
-   experimental_output: Output.object({ schema: mySchema }),
+   output: { schema: mySchema },  // no longer experimental
  });

  result.object // typed via Zod schema
```

### Streaming

```diff
  const stream = streamText({
    model,
    prompt: "Write a story",
+   onChunk: (chunk) => { ... },  // new: per-chunk callback
  });

- for await (const part of stream.textStream) { ... }
+ for await (const part of stream.textStream) { ... }  // unchanged
```

## Step 4 — New Features in v3.0

### Backend Auto-Detection

Gauss automatically detects the best backend:

```ts
import { detectBackend } from "gauss-ai/runtime";

const backend = detectBackend();
// { type: "napi" | "wasm" | "none", version: "1.0.0", module: ... }

// Override with env var:
// GAUSS_BACKEND=napi  (force native)
// GAUSS_BACKEND=wasm  (force WASM)
```

### Team / Multi-Agent

```ts
import { team } from "gauss-ai";

const result = await team()
  .id("research-team")
  .coordinator(supervisorAgent)
  .specialist(researchAgent, { specialties: ["search"] })
  .specialist(writerAgent, { specialties: ["writing"] })
  .strategy("broadcast")  // round-robin | broadcast | delegate | consensus
  .build()
  .run("Research and write about quantum computing");
```

### Graph (DAG Pipeline)

```ts
import { graph } from "gauss-ai";

const pipeline = graph({
  nodes: { research: researchAgent, write: writeAgent, review: reviewAgent },
  edges: [
    { from: "research", to: "write" },
    { from: "write", to: "review" },
  ],
});
const result = await pipeline.run("Write an article about AI");
```

### Workflow DSL

```ts
import { workflow } from "gauss-ai";

const wf = workflow("content-pipeline")
  .then({ id: "research", execute: researchStep })
  .parallel(analyzeStep, summarizeStep)
  .converge("merge", (results) => mergeResults(results))
  .then({ id: "finalize", execute: finalizeStep })
  .build();
```

### Memory (Pluggable)

```ts
import { memory } from "gauss-ai";

const mem = memory({
  provider: "file",  // or "supabase", "in-memory"
  path: "./data/memory",
});
```

### Guardrails

```ts
import { gauss } from "gauss-ai/providers";

// Built-in guardrails via Rust
const model = gauss("openai", "gpt-4o");
// Content moderation, PII detection, token limits, regex filters, schema validation
```

## Step 5 — Environment Variables

| v2.x | v3.0 | Notes |
|------|------|-------|
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | unchanged |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | unchanged |
| - | `GAUSS_BACKEND` | `napi` or `wasm` |
| - | `GAUSS_NAPI_PATH` | custom NAPI path |
| - | `GAUSS_WASM_PATH` | custom WASM path |

## Step 6 — Breaking Changes Summary

| Change | v2.x | v3.0 |
|--------|------|------|
| Provider imports | `@ai-sdk/*` packages | `gauss("type", "model")` |
| Agent creation | `new Agent()` | `Agent()` factory |
| Agent execution | `agent.execute()` | `agent.run()` |
| Token usage fields | `promptTokens` | `inputTokens` |
| Output schema | `experimental_output` | `output` |
| Streaming | AI SDK stream | Same API, native backend |
| Runtime detection | Manual | `detectBackend()` / `detectRuntime()` |

## Troubleshooting

### "gauss-core NAPI module not found"

Install the native backend:
```bash
npm install @gauss-ai/core
```

Or use the WASM fallback:
```bash
npm install @gauss-ai/wasm
```

### "TypeError: Cannot read properties of undefined"

Check that you're importing from `gauss-ai`, not from the old `ai` or
`@ai-sdk/*` packages.

### Tests failing after migration

Run the test suite to identify specific failures:
```bash
npm test
```

Common issue: tool `parameters` vs `inputSchema` — v3.0 uses `parameters`
for Zod schemas and converts internally.
