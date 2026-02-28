# Getting Started

## Installation

```bash
npm install @giulio-leone/gauss
```

### Optional Provider SDKs

Install the provider(s) you need:

```bash
# OpenAI
npm install @ai-sdk/openai

# Anthropic
npm install @ai-sdk/anthropic

# Google
npm install @ai-sdk/google

# Groq
npm install @ai-sdk/groq

# Mistral
npm install @ai-sdk/mistral

# OpenRouter
npm install @openrouter/ai-sdk-provider
```

## Your First Agent

```typescript
import { Agent } from "@giulio-leone/gauss";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("What is hexagonal architecture?");
console.log(result.text);
```

## Agent with Tools

```typescript
import { Agent } from "@giulio-leone/gauss";
import { z } from "zod";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  tools: {
    getWeather: {
      description: "Get current weather for a city",
      parameters: z.object({
        city: z.string().describe("City name"),
      }),
      execute: async ({ city }) => {
        return { temperature: 22, condition: "sunny", city };
      },
    },
  },
});

const result = await agent.run("What's the weather in Rome?");
console.log(result.text);
```

## Streaming

```typescript
const stream = agent.stream("Tell me a story about AI");

for await (const chunk of stream) {
  process.stdout.write(chunk.text ?? "");
}
```

## Basic Concepts

### Ports & Adapters

Gauss uses hexagonal architecture. **Ports** define interfaces (contracts), and **Adapters** provide implementations:

```typescript
// Port — defines the contract
interface VectorStorePort {
  upsert(documents: VectorDocument[]): Promise<void>;
  query(params: VectorSearchParams): Promise<VectorSearchResult[]>;
}

// Adapter — implements the contract
class PineconeVectorStore implements VectorStorePort {
  async upsert(documents) { /* Pinecone-specific logic */ }
  async query(params) { /* Pinecone-specific logic */ }
}
```

### Middleware

Middleware wraps agent execution to add cross-cutting concerns:

```typescript
import { Agent } from "@giulio-leone/gauss";

const agent = await Agent.full({
  model: "openai:gpt-4o",
  middleware: ["logging", "caching", "tripWire"],
});
```

### DI Container

The DI container wires ports to adapters:

```typescript
import { createContainer } from "@giulio-leone/gauss";

const container = createContainer({
  vectorStore: new PineconeVectorStore({ apiKey: "..." }),
  telemetry: new ConsoleTelemetryAdapter(),
});
```

## Next Steps

- [Architecture](./architecture.md) — understand the hexagonal design
- [Agents Guide](./guides/agents.md) — deep dive into agent features
- [Workflows Guide](./guides/workflows.md) — build multi-step workflows
- [RAG Guide](./guides/rag.md) — retrieval-augmented generation
