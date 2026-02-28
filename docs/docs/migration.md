---
sidebar_position: 8
---

# Migration Guide

How to migrate from LangChain or Mastra to Gauss.

## From LangChain

### Concepts Mapping

| LangChain | Gauss | Notes |
|-----------|-------|-------|
| `ChatOpenAI` | `openai("gpt-4o")` | Direct provider function |
| `AgentExecutor` | `agent({...}).build()` | Builder pattern |
| `Tool` | `tool({...})` | AI SDK tool definition |
| `StructuredTool` | `tool({ parameters: z.object })` | Zod schema |
| `VectorStore` | `VectorStorePort` | Port interface |
| `FAISS` / `Chroma` | `InMemoryVectorStore` / `PgVectorStoreAdapter` | Adapters |
| `ConversationChain` | `agent.run(prompt, { sessionId })` | Built-in sessions |
| `LLMChain` → `SequentialChain` | `graph({ nodes: {...} })` | DAG execution |
| `ChatPromptTemplate` | `instructions` string or `PromptTemplate` | Simpler |
| `CallbackHandler` | `BasePlugin` | Lifecycle hooks |

### Code Migration

**LangChain:**
```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";

const model = new ChatOpenAI({ model: "gpt-4o" });
const tools = [new MyTool()];
const agent = await createOpenAIToolsAgent({ llm: model, tools, prompt });
const executor = new AgentExecutor({ agent, tools });
const result = await executor.invoke({ input: "Hello" });
```

**Gauss:**
```typescript
import { agent } from "gauss";
import { openai } from "gauss/providers";
import { tool } from "ai";
import { z } from "zod";

const myAgent = agent({
  model: openai("gpt-4o"),
  instructions: "You are helpful.",
  tools: {
    myTool: tool({
      description: "...",
      parameters: z.object({ input: z.string() }),
      execute: async ({ input }) => "result",
    }),
  },
}).build();
const result = await myAgent.run("Hello");
```

### Key Differences

1. **No chain abstractions** — Gauss uses direct agent runs, not chain composition
2. **Type-safe by default** — Zod schemas for everything, no `Record<string, any>`
3. **No prompt templates** — Use template literals or the built-in `PromptTemplate`
4. **Plugin system** — Instead of callbacks, use structured lifecycle hooks
5. **Multi-runtime** — Works on Edge/Deno/Browser, not just Node.js

---

## From Mastra

### Concepts Mapping

| Mastra | Gauss | Notes |
|--------|-------|-------|
| `Agent` | `agent({...}).build()` | Similar concept |
| `Workflow` | `graph({...})` | DAG-based |
| `Tool` | `tool({...})` (AI SDK) | Same pattern |
| `Syncs` | `StorageDomainPort` adapters | Port-based |
| `mastra.init()` | No init needed | Zero config |
| `Agent.generate()` | `agent.run()` | Different naming |

### Code Migration

**Mastra:**
```typescript
import { Agent, Mastra } from "@mastra/core";

const agent = new Agent({
  name: "assistant",
  model: openai("gpt-4o"),
  instructions: "Be helpful",
  tools: { weather: weatherTool },
});
const mastra = new Mastra({ agents: { assistant: agent } });
const result = await agent.generate("What's the weather?");
```

**Gauss:**
```typescript
import { agent } from "gauss";
import { openai } from "gauss/providers";

const assistant = agent({
  model: openai("gpt-4o"),
  instructions: "Be helpful",
  tools: { weather: weatherTool },
}).build();
const result = await assistant.run("What's the weather?");
```

### Key Differences

1. **No central registry** — Agents are standalone, no `Mastra` init required
2. **Hexagonal architecture** — Clean port/adapter separation vs monolithic
3. **Plugin system** — Extensible lifecycle hooks, not just tool injection
4. **Built-in resilience** — Circuit breaker, rate limiter, retry out of the box
5. **Graph engine** — True DAG execution with parallel scheduling
6. **Multi-runtime** — Edge, Deno, Browser support
