# RAG Pipeline Guide

## Overview

Gauss provides a complete RAG (Retrieval-Augmented Generation) pipeline for ingesting documents, storing embeddings, and querying with semantic search.

## Pipeline Architecture

```
Ingest:  Document → Extract → Transform → Chunk → Embed → Store
Query:   Question → Embed → Search → Diversity Filter → Format → Prompt
```

## Ingestion

### Basic Ingestion

```typescript
import { RagPipeline } from "@giulio-leone/gauss";

const pipeline = new RagPipeline({
  vectorStore: pineconeStore,
  embedding: openAIEmbedding,
  chunking: chunkingAdapter,
});

await pipeline.ingest({
  documents: [
    { id: "doc-1", content: "Long document text...", metadata: { source: "wiki" } },
    { id: "doc-2", content: "Another document...", metadata: { source: "api" } },
  ],
});
```

### Chunking Strategies

Documents are split into manageable chunks before embedding:

```typescript
import { createChunkingAdapter } from "@giulio-leone/gauss";

const chunker = createChunkingAdapter({
  strategy: "recursive",  // "fixed" | "recursive" | "semantic"
  chunkSize: 512,
  chunkOverlap: 50,
});
```

| Strategy | Description | Best For |
|----------|-------------|----------|
| `fixed` | Split by character count | Simple, predictable chunks |
| `recursive` | Split by separators recursively | Prose documents |
| `semantic` | Split by semantic boundaries | Technical documentation |

### Batch Processing

The pipeline processes documents in batches for efficiency:

```typescript
await pipeline.ingest({
  documents: largeDocumentSet,
  batchSize: 100,
  onProgress: (processed, total) => {
    console.log(`${processed}/${total} documents processed`);
  },
});
```

## Querying

### Basic Query

```typescript
const result = await pipeline.query({
  question: "How does the authentication system work?",
  maxResults: 5,
  minRelevance: 0.7,
});

console.log(result.context);   // Formatted context string
console.log(result.documents); // Raw matched documents
```

### Query Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `question` | `string` | — | Natural language query |
| `maxResults` | `number` | `10` | Maximum results to return |
| `minRelevance` | `number` | `0.0` | Minimum similarity score (0–1) |
| `diversityThreshold` | `number` | `0.0` | Filter out near-duplicate results |
| `filter` | `Record<string, unknown>` | `{}` | Metadata filter |

### Diversity Filtering

Reduce redundancy in results:

```typescript
const result = await pipeline.query({
  question: "What are the deployment options?",
  maxResults: 10,
  diversityThreshold: 0.3, // Remove results with >70% similarity
});
```

## Vector Stores

Gauss supports 30+ vector store backends:

| Store | Import | Notes |
|-------|--------|-------|
| **In-Memory** | Built-in | Development and testing |
| **Pinecone** | `pinecone/` | Managed vector database |
| **pgvector** | `pgvector/` | PostgreSQL extension |
| **Qdrant** | `qdrant/` | Open-source vector search |
| **Weaviate** | `weaviate/` | AI-native vector database |
| **Chroma** | `chroma/` | Open-source embedding database |
| **Milvus** | `milvus/` | Scalable vector database |
| **Supabase** | `supabase/` | Supabase pgvector integration |

### Configuring a Vector Store

```typescript
import { PineconeVectorStore } from "@giulio-leone/gauss";

const vectorStore = new PineconeVectorStore({
  apiKey: process.env.PINECONE_API_KEY,
  index: "my-index",
  namespace: "documents",
});
```

## Embeddings

Supported embedding providers:

```typescript
import { OpenAIEmbedding } from "@giulio-leone/gauss";

const embedding = new OpenAIEmbedding({
  model: "text-embedding-3-small",
  dimensions: 1536,
});
```

## Graph RAG

For knowledge-graph-augmented retrieval:

```typescript
import { GraphRagPipeline } from "@giulio-leone/gauss";

const graphRag = new GraphRagPipeline({
  vectorStore: pineconeStore,
  knowledgeGraph: neo4jGraph,
  embedding: openAIEmbedding,
});

const result = await graphRag.query({
  question: "What are the relationships between entities?",
  traversalDepth: 2,
});
```

## Using RAG with Agents

Inject RAG context into agent prompts:

```typescript
const agent = await Agent.auto({
  model: "openai:gpt-4o",
  systemPrompt: "Answer questions using the provided context.",
});

const ragResult = await pipeline.query({
  question: userQuestion,
  maxResults: 5,
});

const answer = await agent.run(
  `Context:\n${ragResult.context}\n\nQuestion: ${userQuestion}`
);
```

## Related

- [Agents Guide](./agents.md) — agent creation
- [Architecture](../architecture.md) — vector store ports
- [Adapters API](../api/adapters.md) — vector store implementations
