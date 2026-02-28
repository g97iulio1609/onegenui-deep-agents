---
sidebar_position: 2
---

# Architecture Deep Dive

Gauss is built on **hexagonal architecture** (Ports & Adapters), ensuring clean separation between business logic and infrastructure concerns.

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│              Public API Surface               │
│  agent() · graph() · rag() · tool()          │
│  gauss/providers · gauss/server               │
├─────────────────────────────────────────────┤
│              Agent Core (Domain)              │
│  Agent class · AgentBuilder · EventSystem     │
│  Context management · Tool loop · Streaming   │
├─────────────────────────────────────────────┤
│              Plugin System                    │
│  Lifecycle hooks · Middleware chain            │
│  Tool injection · Event subscriptions         │
├─────────────────────────────────────────────┤
│              Graph Engine                     │
│  DAG execution · Parallel scheduling          │
│  Consensus · Fork/Join · Subagents            │
├─────────────────────────────────────────────┤
│              Port Interfaces (~40 ports)       │
│  StorageDomainPort · VectorStorePort          │
│  MemoryPort · QueuePort · ObjectStoragePort   │
│  EmbeddingPort · TracingPort · TelemetryPort  │
├─────────────────────────────────────────────┤
│              Adapters                         │
│  PostgreSQL · Redis · S3 · BullMQ · pgvector  │
│  InMemory · File · Supabase · Tiered          │
└─────────────────────────────────────────────┘
```

## Hexagonal Architecture

### Why Hexagonal?

1. **Testability** — Swap any adapter for an in-memory mock
2. **Flexibility** — Change databases without touching business logic
3. **Multi-runtime** — Same core, different adapters per runtime
4. **Future-proof** — New storage backends are just new adapters

### Ports (Interfaces)

Ports define contracts. Key ports include:

| Port | Purpose | Methods |
|------|---------|---------|
| `StorageDomainPort` | Multi-domain CRUD | put, get, delete, query, count, clear |
| `VectorStorePort` | Vector similarity search | upsert, query, delete, indexStats |
| `MemoryPort` | Session state & checkpoints | save/load todos, checkpoints, conversations |
| `QueuePort` | Background job processing | add, process, getJob, pause, resume |
| `ObjectStoragePort` | Blob/file storage | put, get, delete, exists, list |
| `EmbeddingPort` | Text → vector embedding | embed, embedBatch |
| `TracingPort` | Distributed tracing | startSpan, endSpan, setAttributes |

### Adapters (Implementations)

Each port has one or more adapters:

```typescript
// Development
const storage = new InMemoryStorageAdapter();

// Production
const storage = new PostgresStorageAdapter({
  connectionString: process.env.DATABASE_URL,
});

// Both implement the same StorageDomainPort interface
```

### Composite Pattern

Use `CompositeStorageAdapter` for per-domain routing:

```typescript
const storage = new CompositeStorageAdapter(
  new RedisStorageAdapter({ url: "redis://..." }),  // default
  {
    blobs: new S3ObjectStorageAdapter({ bucket: "my-blobs" }),
    vectors: new PgVectorStoreAdapter({ connectionString: "..." }),
  }
);
```

## Agent Lifecycle

```
1. Agent.run(prompt)
   ├── 2. Plugin beforeRun hooks
   ├── 3. Context assembly (memory + RAG retrieval)
   ├── 4. Tool Loop (AI SDK generateText)
   │   ├── Model generates response or tool calls
   │   ├── Tool execution with middleware chain
   │   ├── Result appended to context
   │   └── Loop until model produces final text
   ├── 5. Plugin afterRun hooks
   └── 6. Return AgentResult { text, steps, usage }
```

## Graph Execution Engine

The graph engine uses **reactive push-based scheduling** with:

- **IncrementalReadyTracker** — Tracks node dependencies
- **WorkerPool** — Parallel execution with configurable concurrency
- **AsyncChannel** — Non-blocking result communication

```
     ┌──── Node A ────┐
     │                 │
Input ──┤              ├──── Node C ──── Output
     │                 │
     └──── Node B ────┘
           (parallel)
```

## Plugin Architecture

Plugins hook into the agent lifecycle:

```typescript
class MyPlugin extends BasePlugin {
  name = "my-plugin";

  async beforeRun(context) { /* modify context */ }
  async afterRun(result) { /* process result */ }
  async beforeToolCall(tool, args) { /* intercept */ }
  async afterToolCall(tool, result) { /* transform */ }
}
```

Built-in plugins: WorkflowPlugin, ObservabilityPlugin, GuardrailsPlugin, OneCrawlPlugin.
