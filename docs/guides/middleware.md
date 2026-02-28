# Middleware Guide

## Overview

Gauss provides a composable middleware stack that wraps agent execution. Middleware can transform inputs/outputs, add side effects, short-circuit execution, or enforce guardrails.

## Middleware Pipeline

```
Request → Logging → Caching → TripWire → PromptCaching → ToolCallPatching → Agent → Response
```

Each middleware receives the request, can modify it, call the next middleware, and modify the response.

## Built-in Middleware

### Logging

Logs all agent interactions:

```typescript
import { LoggingMiddleware } from "@giulio-leone/gauss";

const logging = new LoggingMiddleware({
  level: "info",
  includeTokenUsage: true,
});
```

### Caching

Caches agent responses to avoid redundant LLM calls:

```typescript
import { CachingMiddleware } from "@giulio-leone/gauss";

const caching = new CachingMiddleware({
  ttl: 3600,         // Cache TTL in seconds
  maxSize: 1000,     // Max cached entries
  keyStrategy: "hash", // "hash" | "exact"
});
```

### Trip Wire

Guardrails that block or modify unsafe requests:

```typescript
import { TripWireMiddleware } from "@giulio-leone/gauss";

const tripWire = new TripWireMiddleware({
  rules: [
    {
      name: "pii-detection",
      pattern: /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      action: "block",
      message: "PII detected — request blocked",
    },
    {
      name: "content-filter",
      check: async (input) => containsHarmfulContent(input),
      action: "block",
    },
  ],
});
```

### Prompt Caching

Optimizes token usage by caching system prompts and tool definitions at the provider level:

```typescript
import { PromptCachingMiddleware } from "@giulio-leone/gauss";

const promptCaching = new PromptCachingMiddleware({
  enabled: true,
  strategy: "auto", // "auto" | "manual"
});
```

### Tool Call Patching

Intercepts and modifies tool calls before execution:

```typescript
import { ToolCallPatchingMiddleware } from "@giulio-leone/gauss";

const patching = new ToolCallPatchingMiddleware({
  patches: [
    {
      tool: "searchDatabase",
      before: async (args) => {
        // Add default filters
        return { ...args, limit: Math.min(args.limit ?? 10, 100) };
      },
    },
  ],
});
```

### Human-in-the-Loop (HITL)

Requires human approval for sensitive operations:

```typescript
import { HitlMiddleware } from "@giulio-leone/gauss";

const hitl = new HitlMiddleware({
  requiresApproval: ["sendEmail", "deleteRecord", "deployService"],
  approvalHandler: async (toolCall) => {
    const approved = await promptUser(
      `Approve ${toolCall.name}(${JSON.stringify(toolCall.args)})?`
    );
    return approved;
  },
});
```

### Observational Memory

Tracks patterns in agent behavior for learning:

```typescript
import { ObservationalMemoryMiddleware } from "@giulio-leone/gauss";

const memory = new ObservationalMemoryMiddleware({
  maxObservations: 1000,
  categories: ["tool-usage", "error-patterns", "response-quality"],
});
```

### Summarization

Automatically summarizes long conversations to manage context windows:

```typescript
import { SummarizationMiddleware } from "@giulio-leone/gauss";

const summarization = new SummarizationMiddleware({
  maxTokens: 4000,
  strategy: "progressive", // "progressive" | "window" | "map-reduce"
});
```

### Result Eviction

Manages memory by evicting stale or low-relevance results:

```typescript
import { ResultEvictionMiddleware } from "@giulio-leone/gauss";

const eviction = new ResultEvictionMiddleware({
  maxResults: 50,
  evictionPolicy: "lru", // "lru" | "lfu" | "fifo"
});
```

## Custom Middleware

Create custom middleware by implementing the middleware interface:

```typescript
import type { MiddlewarePort } from "@giulio-leone/gauss";

const customMiddleware: MiddlewarePort = {
  name: "timing",
  async execute(context, next) {
    const start = Date.now();
    const result = await next(context);
    const elapsed = Date.now() - start;
    console.log(`Execution took ${elapsed}ms`);
    return result;
  },
};
```

## Composing Middleware

### Using the Chain Builder

```typescript
import { MiddlewareChain } from "@giulio-leone/gauss";

const chain = new MiddlewareChain()
  .use(logging)
  .use(caching)
  .use(tripWire)
  .use(promptCaching)
  .use(customMiddleware);
```

### Middleware Order

Order matters — middleware executes from first to last on the way in, and last to first on the way out:

1. **Logging** — always first, captures everything
2. **Caching** — short-circuits on cache hit
3. **Trip Wire** — blocks before reaching the LLM
4. **Prompt Caching** — optimizes token usage
5. **Tool Call Patching** — modifies tool calls
6. **HITL** — requires approval
7. **Custom** — your middleware

## Related

- [Agents Guide](./agents.md) — using middleware with agents
- [Architecture](../architecture.md) — middleware architecture
- [Middleware API](../api/middleware.md) — API reference
