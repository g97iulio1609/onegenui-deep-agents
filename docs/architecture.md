# Architecture

Gauss follows **hexagonal architecture** (ports & adapters), ensuring every component is pluggable, testable, and runtime-agnostic.

## Hexagonal Architecture

```
                    ┌─────────────────┐
                    │   Application   │
                    │   (Agent Core)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │   Ports   │ │   Ports   │ │   Ports   │
        │ (Storage) │ │   (I/O)   │ │  (Infra)  │
        └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │ Adapters  │ │ Adapters  │ │ Adapters  │
        │(Pinecone) │ │(ElevenLab)│ │ (Express) │
        └───────────┘ └───────────┘ └───────────┘
```

### Ports

Ports are TypeScript interfaces that define contracts. They live in `src/ports/` and contain no implementation logic:

```typescript
// src/ports/vector-store.port.ts
export interface VectorStorePort {
  upsert(documents: VectorDocument[]): Promise<void>;
  query(params: VectorSearchParams): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
}
```

The framework ships **55+ port interfaces** across these categories:

| Category | Ports |
|----------|-------|
| **Storage** | VectorStore, Memory, WorkingMemory, AgentMemory, ObjectStorage, StorageDomain |
| **AI / ML** | Model, Embedding, Reranking, EntityExtractor, KnowledgeGraph, Learning, Datasets |
| **Observability** | Telemetry, Tracing, Metrics, Logging, CostTracker, TokenCounter |
| **Security** | Auth, Policy, Sandbox |
| **I/O** | Voice, SemanticScraping, Filesystem |
| **Infrastructure** | Server, HttpServer, McpServer, Mcp, Acp, Runtime, Queue, SaveQueue |
| **Orchestration** | Workflow, AgentNetwork, Consensus, Suspension, ToolComposition, Skills |
| **Tooling** | Bundler, Compiler, Deployer, HotReload |
| **Core** | DI, Middleware, Plugin, PluginRegistry, PluginManifest |

### Adapters

Adapters implement port interfaces with concrete backends. They live in `src/adapters/<name>/`:

```
src/adapters/
├── vector-store/
│   ├── inmemory.adapter.ts
│   ├── pinecone/
│   ├── pgvector/
│   ├── qdrant/
│   ├── weaviate/
│   ├── chroma/
│   └── ...30 implementations
├── telemetry/
│   ├── console-telemetry.adapter.ts
│   ├── langfuse/
│   ├── langsmith/
│   ├── datadog/
│   └── ...12 implementations
├── auth/
│   ├── jwt.adapter.ts
│   ├── supabase/
│   └── ...5 implementations
└── ...53 adapter groups
```

## Middleware Stack

The middleware system wraps agent execution as a composable pipeline:

```
Request → Logging → Caching → TripWire → PromptCaching → Agent → Response
```

Each middleware can:
- Transform input/output
- Short-circuit execution (e.g., cache hit)
- Add side effects (e.g., logging, metrics)
- Block execution (e.g., trip wire guardrails)

See [Middleware Guide](./guides/middleware.md) for details.

## Multi-Runtime Support

Gauss runs on multiple JavaScript runtimes:

| Runtime | Import Path | Notes |
|---------|-------------|-------|
| **Node.js** | `@giulio-leone/gauss/node` | Full feature set |
| **Deno** | `@giulio-leone/gauss/deno` | Native Deno support |
| **Edge** | `@giulio-leone/gauss/edge` | Cloudflare Workers, Vercel Edge |
| **Browser** | `@giulio-leone/gauss/browser` | Client-side agents |

## Agent Graph Engine

Multi-agent coordination with:

- **AgentGraph** — define agent topology and connections
- **GraphExecutor** — execute with checkpointing and fault tolerance
- **AgentSupervisor** — restart policies, fault recovery
- **TeamBuilder** — coordinated team execution
- **WorkerPool** — parallel execution with token budget control
- **DynamicAgentGraph** — runtime graph mutations

```typescript
import { AgentGraphBuilder, GraphExecutor } from "@giulio-leone/gauss";

const graph = new AgentGraphBuilder()
  .addNode("researcher", researchAgent)
  .addNode("writer", writerAgent)
  .addEdge("researcher", "writer")
  .build();

const executor = new GraphExecutor(graph);
const result = await executor.execute({ topic: "AI safety" });
```

## Plugin System

Extensible plugin architecture:

- **PluginRegistry** — discover and manage plugins
- **PluginManifest** — declarative plugin metadata
- **HotReload** — live plugin updates in development
- **Marketplace** — browse and install community plugins

## DI Container

Dependency injection wires ports to adapters at runtime:

```typescript
import { createContainer } from "@giulio-leone/gauss";

const container = createContainer({
  vectorStore: new PineconeVectorStore({ /* config */ }),
  telemetry: new LangfuseTelemetryAdapter({ /* config */ }),
  auth: new JwtAuthAdapter({ secret: process.env.JWT_SECRET }),
});

const agent = await Agent.auto({ container });
```

## Related

- [Getting Started](./getting-started.md)
- [Agents Guide](./guides/agents.md)
- [Middleware Guide](./guides/middleware.md)
- [Ports API](./api/ports.md)
- [Adapters API](./api/adapters.md)
