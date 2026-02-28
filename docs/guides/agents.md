# Agents Guide

## Overview

Agents are the core execution unit in Gauss. An agent combines an LLM model with tools, middleware, and plugins to handle complex tasks autonomously.

## Creating Agents

### Quick Start with `Agent.auto()`

The simplest way to create an agent with sensible defaults:

```typescript
import { Agent } from "@giulio-leone/gauss";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  systemPrompt: "You are a helpful coding assistant.",
});

const result = await agent.run("Explain closures in JavaScript");
console.log(result.text);
```

### Minimal Agent with `Agent.minimal()`

For lightweight use cases without middleware or plugins:

```typescript
const agent = await Agent.minimal({
  model: "anthropic:claude-sonnet-4-20250514",
});
```

### Full Agent with `Agent.full()`

For production use with all features enabled:

```typescript
const agent = await Agent.full({
  model: "openai:gpt-4o",
  middleware: ["logging", "caching", "tripWire", "promptCaching"],
  plugins: ["web-search", "code-execution"],
});
```

## Tools

Tools give agents the ability to interact with the outside world.

### Defining Tools

```typescript
import { z } from "zod";

const tools = {
  searchDatabase: {
    description: "Search the product database",
    parameters: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ query, limit }) => {
      const results = await db.search(query, limit);
      return results;
    },
  },

  sendEmail: {
    description: "Send an email to a user",
    parameters: z.object({
      to: z.string().email(),
      subject: z.string(),
      body: z.string(),
    }),
    requiresApproval: true, // Human-in-the-loop
    execute: async ({ to, subject, body }) => {
      await emailService.send({ to, subject, body });
      return { sent: true };
    },
  },
};

const agent = await Agent.auto({ model: "openai:gpt-4o", tools });
```

### MCP Tools

Connect to MCP (Model Context Protocol) servers for external tool providers:

```typescript
import { Agent } from "@giulio-leone/gauss";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  mcpServers: [
    { url: "http://localhost:3001/mcp" },
  ],
});
```

## Streaming

### Text Streaming

```typescript
const stream = agent.stream("Write a poem about recursion");

for await (const chunk of stream) {
  process.stdout.write(chunk.text ?? "");
}
```

### Structured Output

```typescript
import { z } from "zod";

const result = await agent.run("Analyze this code for bugs", {
  output: z.object({
    bugs: z.array(z.object({
      line: z.number(),
      description: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    })),
    summary: z.string(),
  }),
});

console.log(result.output.bugs);
```

## Resilience

Agents include built-in resilience features:

### Circuit Breaker

Prevents cascading failures when an external service is down:

```typescript
const agent = await Agent.auto({
  model: "openai:gpt-4o",
  resilience: {
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 30_000,
    },
  },
});
```

### Rate Limiter

Throttles requests to stay within API limits:

```typescript
const agent = await Agent.auto({
  model: "openai:gpt-4o",
  resilience: {
    rateLimiter: {
      maxRequests: 60,
      windowMs: 60_000,
    },
  },
});
```

## Lifecycle

Agents support lifecycle hooks:

```typescript
const agent = await Agent.auto({
  model: "openai:gpt-4o",
  hooks: {
    onStartup: async () => { /* initialize resources */ },
    onShutdown: async () => { /* cleanup */ },
    onError: async (error) => { /* handle errors */ },
  },
});

await agent.startup();
// ... use agent ...
await agent.shutdown();
```

## Token Tracking

Built-in usage and cost tracking:

```typescript
const result = await agent.run("Complex analysis task");

console.log(result.usage);
// { promptTokens: 1234, completionTokens: 567, totalTokens: 1801 }
```

## Related

- [Getting Started](../getting-started.md)
- [Workflows Guide](./workflows.md) — multi-step agent orchestration
- [Middleware Guide](./middleware.md) — extend agent behavior
- [RAG Guide](./rag.md) — knowledge-augmented agents
