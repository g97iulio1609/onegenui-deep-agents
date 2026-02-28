---
sidebar_position: 1
---

# What is Gauss?

**Gauss** is a production-ready AI agent framework built on [Vercel AI SDK v6](https://sdk.vercel.ai). It provides everything you need to build, deploy, and observe intelligent agents — from simple chat bots to complex multi-agent workflows.

## Why Gauss?

| Feature | Gauss | LangChain | Mastra |
|---------|-------|-----------|--------|
| **Architecture** | Hexagonal (Ports & Adapters) | Chain-based | Workflow-based |
| **Type Safety** | Full TypeScript, Zod schemas | Partial | Partial |
| **Multi-Runtime** | Node, Deno, Edge, Browser | Node only | Node only |
| **Provider Lock-in** | Zero (AI SDK adapters) | Moderate | Low |
| **Plugin System** | Middleware + lifecycle hooks | Limited | None |
| **Built-in Observability** | Traces, metrics, logging | Via LangSmith | Basic |
| **Graph Execution** | DAG with parallel, consensus | Sequential chains | Workflows |

## Core Concepts

### Agents

An agent is an AI model with instructions, tools, and memory. It runs in a tool-loop — the model decides which tools to call, processes results, and continues until the task is complete.

```typescript
import { agent } from "gauss";
import { openai } from "gauss/providers";

const myAgent = agent({
  model: openai("gpt-4o"),
  instructions: "You are a helpful assistant.",
}).build();

const result = await myAgent.run("Hello!");
```

### Tools

Tools are functions the agent can call. Define them with Zod schemas for automatic parameter validation.

```typescript
import { tool } from "ai";
import { z } from "zod";

const weatherTool = tool({
  description: "Get weather for a city",
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ temp: 22, city }),
});
```

### Graphs

Graphs enable multi-agent workflows with dependency-based execution. Agents run in parallel when possible.

```typescript
import { graph } from "gauss";

const workflow = graph({
  name: "pipeline",
  nodes: {
    research: { agent: researcher },
    write: { agent: writer, dependsOn: ["research"] },
  },
  output: "write",
});
```

### RAG (Retrieval-Augmented Generation)

RAG pipelines retrieve relevant context from vector stores before generating responses.

```typescript
import { rag, InMemoryVectorStore } from "gauss";

const pipeline = rag({ vectorStore: new InMemoryVectorStore(), topK: 5 });
await pipeline.ingest([{ id: "1", content: "...", metadata: {} }]);
```

### Ports & Adapters

Gauss uses hexagonal architecture. Every external dependency is abstracted behind a **port** (interface). You can swap implementations without changing business logic.

**Built-in Adapters:**
- **Storage:** In-Memory, PostgreSQL, Redis
- **Vector Store:** In-Memory, pgvector
- **Object Storage:** S3/MinIO/R2
- **Queue:** BullMQ/Redis
- **Providers:** OpenAI, Anthropic, Google, Groq, Ollama, OpenRouter

## Architecture Overview

```
┌─────────────────────────────────────┐
│           Application Layer          │
│  agent() · graph() · rag() · tool() │
├─────────────────────────────────────┤
│            Domain Layer              │
│  Agent · Graph · RAG · Plugins       │
├─────────────────────────────────────┤
│             Port Layer               │
│  StoragePort · VectorStorePort · ... │
├─────────────────────────────────────┤
│           Adapter Layer              │
│  Postgres · Redis · S3 · BullMQ     │
└─────────────────────────────────────┘
```

## Getting Started

```bash
npx gauss init --template chat my-agent
cd my-agent && npm install
npm run dev
```

See the [Templates](/docs/templates) for all available starter kits.
