---
sidebar_position: 7
title: Adapter Classes
description: Complete reference for all Gauss adapter implementations
---

# Adapter Classes

Adapters are concrete implementations of [port interfaces](./ports). The framework ships with defaults for every port.

## Filesystem Adapters

### VirtualFilesystem

In-memory filesystem with optional disk persistence. **Default adapter.**

```typescript
import { VirtualFilesystem } from "gauss";

const vfs = new VirtualFilesystem();
await vfs.write("/hello.txt", "Hello, world!");
const content = await vfs.read("/hello.txt");
```

Supports transient and persistent zones, optional disk sync via `syncToPersistent()`.

### LocalFilesystem

Sandboxed wrapper over Node.js `fs`. Restricts operations to a configured base path.

```typescript
import { LocalFilesystem } from "gauss/node";

const fs = new LocalFilesystem("/path/to/project");
const content = await fs.read("src/index.ts");
```

## Memory Adapters

### InMemoryAdapter

`Map`-based in-process storage. **Default adapter.** Suitable for testing and ephemeral sessions.

```typescript
import { InMemoryAdapter } from "gauss";

const memory = new InMemoryAdapter();
await memory.saveTodos("session-1", [{ id: "1", title: "Task", status: "pending" }]);
```

### SupabaseMemoryAdapter

Supabase-backed persistent storage using `deep_agent_todos`, `deep_agent_checkpoints`, `deep_agent_conversations`, and `deep_agent_metadata` tables.

```typescript
import { SupabaseMemoryAdapter } from "gauss";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const memory = new SupabaseMemoryAdapter(supabase);
```

## Runtime Adapters

### Auto-Detection

```typescript
import { detectRuntimeName, createRuntimeAdapter } from "gauss";

const runtimeName = detectRuntimeName(); // "node" | "deno" | "bun" | "edge"
const runtime = createRuntimeAdapter();  // Auto-selects based on environment
```

### NodeRuntimeAdapter

```typescript
import { NodeRuntimeAdapter } from "gauss";
const runtime = new NodeRuntimeAdapter();
runtime.getEnv("NODE_ENV"); // process.env.NODE_ENV
```

### DenoRuntimeAdapter

```typescript
import { DenoRuntimeAdapter } from "gauss";
const runtime = new DenoRuntimeAdapter();
runtime.getEnv("DENO_ENV"); // Deno.env.get("DENO_ENV")
```

### BunRuntimeAdapter

```typescript
import { BunRuntimeAdapter } from "gauss";
const runtime = new BunRuntimeAdapter();
```

### EdgeRuntimeAdapter

For Cloudflare Workers and Vercel Edge. Environment variables are bound via request context, so `getEnv()` returns `undefined`.

```typescript
import { EdgeRuntimeAdapter } from "gauss";
const runtime = new EdgeRuntimeAdapter();
```

## Token Counter Adapters

### ApproximateTokenCounter

Fast estimation using ~4 characters per token. **Default adapter.** Includes context window sizes for common models.

```typescript
import { ApproximateTokenCounter } from "gauss";

const counter = new ApproximateTokenCounter();
counter.count("Hello, world!"); // ~3
```

### TiktokenTokenCounter

BPE-accurate counting via the `tiktoken` library.

```typescript
import { TiktokenTokenCounter } from "gauss/node";

const counter = new TiktokenTokenCounter();
counter.count("Hello, world!", "gpt-4o"); // Exact token count
```

## Validation Adapters

### ZodValidationAdapter

Zod-based implementation of `ValidationPort`. **Default adapter.**

```typescript
import { ZodValidationAdapter } from "gauss";
import { z } from "zod";

const validator = new ZodValidationAdapter();

// Safe validation
const result = validator.validate(z.string().email(), "user@example.com");
// { success: true, data: "user@example.com" }

// Throwing validation
const email = validator.validateOrThrow(z.string().email(), "bad");
// Throws ZodError
```

## Tracing Adapters

### InMemoryTracingAdapter

In-memory span storage. Useful for testing and development.

```typescript
import { InMemoryTracingAdapter } from "gauss";

const tracer = new InMemoryTracingAdapter();
const span = tracer.startSpan("my-operation");
span.setAttribute("key", "value");
span.setStatus("ok");
span.end();
```

## Metrics Adapters

### InMemoryMetricsAdapter

In-memory counters, histograms, and gauges.

```typescript
import { InMemoryMetricsAdapter } from "gauss";

const metrics = new InMemoryMetricsAdapter();
metrics.incrementCounter("requests.total");
metrics.recordHistogram("response.latency", 42);
metrics.recordGauge("connections.active", 5);
```

## Logging Adapters

### ConsoleLoggingAdapter

Structured logging via `console.log`, `console.warn`, and `console.error`.

```typescript
import { ConsoleLoggingAdapter } from "gauss";

const logger = new ConsoleLoggingAdapter();
logger.info("Server started", { port: 3000 });
logger.error("Connection failed", { host: "db.example.com" });
```

## Learning Adapters

### InMemoryLearningAdapter

`Map`-based in-process learning storage.

```typescript
import { InMemoryLearningAdapter } from "gauss";

const learning = new InMemoryLearningAdapter();
await learning.updateProfile("user-1", { style: "concise", language: "en" });
await learning.addMemory("user-1", { content: "Prefers TypeScript", tags: ["preference"] });
```

## MCP Adapters

### AiSdkMcpAdapter

Bridges `@ai-sdk/mcp` clients to the `McpPort` interface. Supports stdio, HTTP, and SSE transports.

```typescript
import { AiSdkMcpAdapter } from "gauss";

const mcp = new AiSdkMcpAdapter({
  servers: [
    {
      id: "web-search",
      name: "Web Search",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@anthropic/web-search-mcp"],
    },
  ],
});
```

### GaussMcpAdapter

Bridges `@giulio-leone/gaussflow-mcp` `McpRegistry` to the `McpPort` interface.

```typescript
import { GaussMcpAdapter } from "gauss";

const mcp = new GaussMcpAdapter(mcpRegistry);
```

## Consensus Adapters

### LlmJudgeConsensus

Uses an LLM to evaluate fork results and pick the best output.

```typescript
import { LlmJudgeConsensus } from "gauss";

const consensus = new LlmJudgeConsensus({ model: openai("gpt-4o") });
```

### MajorityVoteConsensus

Simple majority vote across fork outputs.

```typescript
import { MajorityVoteConsensus } from "gauss";

const consensus = new MajorityVoteConsensus();
```

### DebateConsensus

Multi-round debate between fork outputs.

```typescript
import { DebateConsensus } from "gauss";

const consensus = new DebateConsensus({ model: openai("gpt-4o"), rounds: 3 });
```

## Resilience Adapters

### CircuitBreaker

Implements the circuit breaker pattern to prevent cascading failures by temporarily blocking operations that are likely to fail.

```typescript
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from "gauss";

// With custom configuration
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,        // Open after 5 consecutive failures
  resetTimeoutMs: 30_000,     // Wait 30 seconds before trying half-open
  monitorWindowMs: 60_000,    // Track failures over 1 minute window
});

// With default configuration
const defaultBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);

// Manual usage
await circuitBreaker.execute(async () => {
  const response = await fetch("https://api.example.com/data");
  if (!response.ok) throw new Error("API failed");
  return response.json();
});

// Check state
console.log("Circuit state:", circuitBreaker.getState()); // 'closed', 'open', or 'half-open'
console.log("Failure count:", circuitBreaker.getFailureCount());
```

### RateLimiter

Controls request rate using token bucket algorithm to prevent overwhelming services.

```typescript
import { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "gauss";

// With custom configuration
const rateLimiter = new RateLimiter({
  maxTokens: 10,              // Maximum burst capacity
  refillRateMs: 1000,         // Add 1 token every 1000ms
});

// With default configuration
const defaultLimiter = new RateLimiter(DEFAULT_RATE_LIMITER_CONFIG);

// Wait for token (queues if necessary)
await rateLimiter.acquire();
console.log("Token acquired, can proceed");

// Try immediate acquisition
if (rateLimiter.tryAcquire()) {
  console.log("Token available immediately");
} else {
  console.log("No tokens available, would need to wait");
}
```

### ToolCache

LRU cache with TTL support for tool execution results.

```typescript
import { ToolCache, DEFAULT_TOOL_CACHE_CONFIG } from "gauss";

// With custom configuration
const toolCache = new ToolCache({
  defaultTtlMs: 300_000,      // 5 minute default TTL
  maxSize: 1000,              // Maximum 1000 entries
});

// With default configuration
const defaultCache = new ToolCache(DEFAULT_TOOL_CACHE_CONFIG);

// Store with default TTL
toolCache.set("expensive-operation", { result: "computed value" });

// Store with custom TTL (1 hour)
toolCache.set("long-lived-data", { data: "important" }, 3600_000);

// Retrieve cached values
const cached = toolCache.get("expensive-operation");
if (cached) {
  console.log("Cache hit:", cached);
}

// Check cache statistics
console.log("Cache stats:", toolCache.getStats());
// Output: { size: 2, hits: 1, misses: 0, hitRate: 1 }

// Clear cache
toolCache.clear();
```

### Combined Usage with Agent

All resilience adapters can be used together for maximum robustness:

```typescript
import { 
  Agent, 
  CircuitBreaker, 
  RateLimiter, 
  ToolCache 
} from "gauss";

const agent = Agent.create({
  model: openai("gpt-4o"),
  instructions: "You are a resilient assistant.",
})
  .withCircuitBreaker(new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 30_000,
  }))
  .withRateLimiter(new RateLimiter({
    maxTokens: 5,
    refillRateMs: 2000,
  }))
  .withToolCache(new ToolCache({
    defaultTtlMs: 600_000,
    maxSize: 1000,
  }))
  .build();
```
