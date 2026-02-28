# Middleware API Reference

## Overview

All middleware lives in `src/middleware/` and implements the middleware port interface. Middleware is composable via the `MiddlewareChain`.

## MiddlewarePort Interface

```typescript
interface MiddlewarePort {
  name: string;
  execute(context: MiddlewareContext, next: NextFn): Promise<MiddlewareResult>;
}

type NextFn = (context: MiddlewareContext) => Promise<MiddlewareResult>;

interface MiddlewareContext {
  input: string;
  messages: Message[];
  tools: ToolDefinition[];
  metadata: Record<string, unknown>;
}
```

## MiddlewareChain

```typescript
import { MiddlewareChain } from "@giulio-leone/gauss";

const chain = new MiddlewareChain();
chain.use(middleware1);
chain.use(middleware2);
chain.use(middleware3);

const result = await chain.execute(context);
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `use` | `use(middleware: MiddlewarePort): this` | Add middleware to the chain |
| `execute` | `execute(context: MiddlewareContext): Promise<MiddlewareResult>` | Execute the chain |

## Built-in Middleware

### LoggingMiddleware

**File:** `src/middleware/logging.ts`

```typescript
import { LoggingMiddleware } from "@giulio-leone/gauss";

const logging = new LoggingMiddleware({
  level: "info",          // "debug" | "info" | "warn" | "error"
  includeTokenUsage: true,
  includeTimings: true,
});
```

### CachingMiddleware

**File:** `src/middleware/caching.ts`

```typescript
import { CachingMiddleware } from "@giulio-leone/gauss";

const caching = new CachingMiddleware({
  ttl: 3600,
  maxSize: 1000,
  keyStrategy: "hash",
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | `number` | `3600` | Cache TTL in seconds |
| `maxSize` | `number` | `1000` | Max cached entries |
| `keyStrategy` | `"hash" \| "exact"` | `"hash"` | Cache key generation |

### TripWireMiddleware

**File:** `src/middleware/trip-wire.ts`

```typescript
import { TripWireMiddleware } from "@giulio-leone/gauss";

const tripWire = new TripWireMiddleware({
  rules: [
    {
      name: "rule-name",
      pattern: /regex/,
      action: "block",        // "block" | "warn" | "redact"
      message: "Blocked",
    },
  ],
});
```

### PromptCachingMiddleware

**File:** `src/middleware/prompt-caching.ts`

```typescript
import { PromptCachingMiddleware } from "@giulio-leone/gauss";

const promptCaching = new PromptCachingMiddleware({
  enabled: true,
  strategy: "auto",
});
```

### ToolCallPatchingMiddleware

**File:** `src/middleware/tool-call-patching.ts`

```typescript
import { ToolCallPatchingMiddleware } from "@giulio-leone/gauss";

const patching = new ToolCallPatchingMiddleware({
  patches: [
    {
      tool: "toolName",
      before: async (args) => modifiedArgs,
      after: async (result) => modifiedResult,
    },
  ],
});
```

### HitlMiddleware

**File:** `src/middleware/hitl.ts`

```typescript
import { HitlMiddleware } from "@giulio-leone/gauss";

const hitl = new HitlMiddleware({
  requiresApproval: ["dangerousTool"],
  approvalHandler: async (toolCall) => boolean,
  timeout: 30_000,
});
```

### ObservationalMemoryMiddleware

**File:** `src/middleware/observational-memory.ts`

```typescript
import { ObservationalMemoryMiddleware } from "@giulio-leone/gauss";

const memory = new ObservationalMemoryMiddleware({
  maxObservations: 1000,
  categories: ["tool-usage", "error-patterns"],
});
```

### SummarizationMiddleware

**File:** `src/middleware/summarization.ts`

```typescript
import { SummarizationMiddleware } from "@giulio-leone/gauss";

const summarization = new SummarizationMiddleware({
  maxTokens: 4000,
  strategy: "progressive",
});
```

| Strategy | Description |
|----------|-------------|
| `progressive` | Incrementally summarize as context grows |
| `window` | Keep a sliding window of recent messages |
| `map-reduce` | Chunk and summarize in parallel |

### ResultEvictionMiddleware

**File:** `src/middleware/result-eviction.ts`

```typescript
import { ResultEvictionMiddleware } from "@giulio-leone/gauss";

const eviction = new ResultEvictionMiddleware({
  maxResults: 50,
  evictionPolicy: "lru",
});
```

### SkillsMiddleware

**File:** `src/middleware/skills.ts`

```typescript
import { SkillsMiddleware } from "@giulio-leone/gauss";

const skills = new SkillsMiddleware({
  skillStore: mySkillStore,
  autoDetect: true,
});
```

### ProcessorMiddleware

**File:** `src/middleware/processor.ts`

Generic input/output processing pipeline:

```typescript
import { ProcessorMiddleware } from "@giulio-leone/gauss";

const processor = new ProcessorMiddleware({
  inputProcessors: [sanitizeInput, addContext],
  outputProcessors: [formatResponse, addMetadata],
});
```

## Related

- [Middleware Guide](../guides/middleware.md) — usage patterns
- [Ports API](./ports.md) — MiddlewarePort definition
- [Agents Guide](../guides/agents.md) — using middleware with agents
