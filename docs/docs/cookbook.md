---
sidebar_position: 10
---

# Cookbook: 20 Copy-Paste Recipes

Ready-to-use patterns for common tasks. Each recipe is self-contained.

## 1. Simple Chat Agent

```typescript
import { agent } from "gauss";
import { openai } from "gauss/providers";

const chat = agent({ model: openai("gpt-4o-mini"), instructions: "Be helpful." }).build();
const { text } = await chat.run("Hello!");
```

## 2. Streaming Response

```typescript
const stream = await chat.run("Tell me a story", { stream: true });
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## 3. Custom Tool

```typescript
import { tool } from "ai";
import { z } from "zod";

const myTool = tool({
  description: "Search the database",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => db.search(query),
});
```

## 4. Agent with Tools

```typescript
const a = agent({
  model: openai("gpt-4o"),
  instructions: "Use tools when helpful.",
  tools: { search: myTool },
}).build();
```

## 5. Multi-Provider Setup

```typescript
import { openai, anthropic, ollama } from "gauss/providers";

const fast = agent({ model: openai("gpt-4o-mini"), instructions: "..." }).build();
const smart = agent({ model: anthropic("claude-sonnet-4-20250514"), instructions: "..." }).build();
const local = agent({ model: ollama("llama3.2"), instructions: "..." }).build();
```

## 6. RAG with Vector Store

```typescript
import { rag, InMemoryVectorStore } from "gauss";
const pipeline = rag({ vectorStore: new InMemoryVectorStore(), topK: 5 });
await pipeline.ingest([{ id: "1", content: "Docs...", metadata: {} }]);
```

## 7. PostgreSQL Vector Store (Production)

```typescript
import { PgVectorStoreAdapter } from "gauss";
const store = new PgVectorStoreAdapter({
  connectionString: process.env.DATABASE_URL!,
  dimensions: 1536,
});
await store.initialize();
```

## 8. Redis Caching Layer

```typescript
import { RedisStorageAdapter } from "gauss";
const cache = new RedisStorageAdapter({ url: "redis://localhost:6379", ttl: 3600 });
await cache.initialize();
```

## 9. S3 Object Storage

```typescript
import { S3ObjectStorageAdapter } from "gauss";
const s3 = new S3ObjectStorageAdapter({ bucket: "my-agents", region: "us-east-1" });
await s3.put("report.pdf", fileBuffer, { contentType: "application/pdf" });
```

## 10. Background Job Queue

```typescript
import { BullMQQueueAdapter } from "gauss";
const queue = new BullMQQueueAdapter({ queueName: "agent-tasks" });
await queue.add("process", { agentId: "123", prompt: "Analyze this" });
await queue.process(async (job) => {
  const result = await myAgent.run(job.data.prompt);
  return result.text;
});
```

## 11. Multi-Agent Graph

```typescript
import { graph } from "gauss";
const workflow = graph({
  name: "pipeline",
  nodes: {
    a: { agent: researcher },
    b: { agent: writer, dependsOn: ["a"] },
  },
  output: "b",
});
```

## 12. Plugin System

```typescript
import { BasePlugin } from "gauss";
class LogPlugin extends BasePlugin {
  name = "logger";
  async beforeRun(ctx) { console.log("Starting:", ctx.prompt); }
  async afterRun(res) { console.log("Done:", res.text.slice(0, 100)); }
}
```

## 13. Guardrails (Input Validation)

```typescript
import { z } from "zod";
const a = agent({
  model: openai("gpt-4o"),
  instructions: "Only answer coding questions.",
  inputSchema: z.object({ prompt: z.string().max(1000) }),
}).build();
```

## 14. Circuit Breaker

```typescript
import { CircuitBreaker } from "gauss";
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000 });
const a = Agent.create({ model: openai("gpt-4o") })
  .withCircuitBreaker(breaker)
  .build();
```

## 15. Rate Limiter

```typescript
import { RateLimiter } from "gauss";
const limiter = new RateLimiter({ maxTokens: 10, refillRatePerSecond: 2 });
const a = Agent.create({ model: openai("gpt-4o") })
  .withRateLimiter(limiter)
  .build();
```

## 16. Playground Setup

```typescript
import { registerPlaygroundRoutes, PlaygroundCollector } from "gauss";
const collector = new PlaygroundCollector();
registerPlaygroundRoutes({
  server: myHttpServer,
  agents: [collector.asPlaygroundAgent({ name: "main", invoke: (p) => myAgent.run(p) })],
});
```

## 17. REST API Server

```typescript
import { GaussRestServer } from "gauss/rest";
const server = new GaussRestServer({ agent: myAgent, port: 3000 });
await server.start();
// POST /api/chat { prompt: "..." } → { text: "..." }
```

## 18. Session Memory

```typescript
const result1 = await myAgent.run("My name is Alice", { sessionId: "s1" });
const result2 = await myAgent.run("What's my name?", { sessionId: "s1" });
// result2.text → "Your name is Alice"
```

## 19. Composite Storage (Multi-Backend)

```typescript
import { CompositeStorageAdapter, InMemoryStorageAdapter, PostgresStorageAdapter } from "gauss";
const storage = new CompositeStorageAdapter(
  new InMemoryStorageAdapter(),  // fast default
  { scores: new PostgresStorageAdapter({ connectionString: "..." }) }  // durable for scores
);
```

## 20. OpenRouter (Access 100+ Models)

```typescript
import { openrouter } from "gauss/providers";
const a = agent({
  model: openrouter("anthropic/claude-sonnet-4-20250514"),
  instructions: "You are helpful.",
}).build();
```
