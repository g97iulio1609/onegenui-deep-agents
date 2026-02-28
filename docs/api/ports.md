# Ports API Reference

All port interfaces are defined in `src/ports/` and follow the hexagonal architecture pattern. Each port defines a contract that adapters implement.

## Storage

### VectorStorePort

**File:** `src/ports/vector-store.port.ts`

```typescript
interface VectorStorePort {
  upsert(documents: VectorDocument[]): Promise<void>;
  query(params: VectorSearchParams): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  indexStats(): Promise<VectorIndexStats>;
}
```

### MemoryPort

**File:** `src/ports/memory.port.ts`

Persistent memory for agent state across sessions.

### WorkingMemoryPort

**File:** `src/ports/working-memory.port.ts`

Short-term working memory for in-flight context.

### AgentMemoryPort

**File:** `src/ports/agent-memory.port.ts`

Agent-specific memory with episodic and semantic recall.

### ObjectStoragePort

**File:** `src/ports/object-storage.port.ts`

Blob/object storage for files and artifacts.

### StorageDomainPort

**File:** `src/ports/storage-domain.port.ts`

Domain-driven storage abstraction.

## AI / ML

### ModelPort

**File:** `src/ports/model.port.ts`

LLM model interface for text generation.

### EmbeddingPort

**File:** `src/ports/embedding.port.ts`

Text embedding generation.

### RerankingPort

**File:** `src/ports/reranking.port.ts`

Result reranking for improved search relevance.

### EntityExtractorPort

**File:** `src/ports/entity-extractor.port.ts`

Named entity extraction from text.

### KnowledgeGraphPort

**File:** `src/ports/knowledge-graph.port.ts`

Knowledge graph operations — nodes, edges, traversal.

### LearningPort

**File:** `src/ports/learning.port.ts`

Agent learning and adaptation.

### DatasetsPort

**File:** `src/ports/datasets.port.ts`

Dataset management for evaluation and fine-tuning.

## Observability

### TelemetryPort

**File:** `src/ports/telemetry.port.ts`

```typescript
interface TelemetryPort {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): TelemetrySpan;
  recordMetric(name: string, value: number, attributes?: Record<string, string>): void;
  flush(): Promise<void>;
}
```

### TracingPort

**File:** `src/ports/tracing.port.ts`

Distributed tracing for agent execution.

### MetricsPort

**File:** `src/ports/metrics.port.ts`

Metrics collection and reporting.

### LoggingPort

**File:** `src/ports/logging.port.ts`

Structured logging interface.

### CostTrackerPort

**File:** `src/ports/cost-tracker.port.ts`

API cost tracking and budgeting.

### TokenCounterPort

**File:** `src/ports/token-counter.port.ts`

Token counting for various models.

## Security

### AuthPort

**File:** `src/ports/auth.port.ts`

```typescript
interface AuthPort {
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  authorize(user: AuthUser, resource: string, action: string): Promise<boolean>;
  refresh(token: string): Promise<AuthResult>;
}
```

### PolicyPort

**File:** `src/ports/policy.port.ts`

Policy evaluation and enforcement.

### SandboxPort

**File:** `src/ports/sandbox.port.ts`

Sandboxed code execution.

## I/O

### VoicePort

**File:** `src/ports/voice.port.ts`

Speech-to-text and text-to-speech.

### SemanticScrapingPort

**File:** `src/ports/semantic-scraping.port.ts`

Intelligent web scraping with semantic understanding.

### FilesystemPort

**File:** `src/ports/filesystem.port.ts`

File system operations.

## Infrastructure

### ServerPort

**File:** `src/ports/server.port.ts`

Server lifecycle management.

### HttpServerPort

**File:** `src/ports/http-server.port.ts`

HTTP server abstraction.

### McpServerPort

**File:** `src/ports/mcp-server.port.ts`

Model Context Protocol server.

### McpPort

**File:** `src/ports/mcp.port.ts`

MCP client for connecting to external tool servers.

### AcpPort

**File:** `src/ports/acp.port.ts`

Agent Communication Protocol.

### RuntimePort

**File:** `src/ports/runtime.port.ts`

Runtime environment detection and capabilities.

### QueuePort

**File:** `src/ports/queue.port.ts`

Job queue for async task processing.

### SaveQueuePort

**File:** `src/ports/save-queue.port.ts`

Batched persistence queue.

## Orchestration

### WorkflowPort

**File:** `src/ports/workflow.port.ts`

Workflow definition and execution.

### AgentNetworkPort

**File:** `src/ports/agent-network.port.ts`

Multi-agent network communication.

### ConsensusPort

**File:** `src/ports/consensus.port.ts`

Multi-agent consensus mechanism.

### SuspensionPort

**File:** `src/ports/suspension.port.ts`

Agent execution suspension and resumption.

### ToolCompositionPort

**File:** `src/ports/tool-composition.port.ts`

Tool composition and chaining.

### SkillsPort

**File:** `src/ports/skills.port.ts`

Agent skill management.

### SkillMatcherPort

**File:** `src/ports/skill-matcher.port.ts`

Skill matching and routing.

## Processing

### ChunkingPort

**File:** `src/ports/chunking.port.ts`

Document chunking strategies.

### DocumentPort

**File:** `src/ports/document.port.ts`

Document extraction and parsing.

### PartialJsonPort

**File:** `src/ports/partial-json.port.ts`

Partial JSON parsing for streaming.

### SerializerPort

**File:** `src/ports/serializer.port.ts`

State serialization and deserialization.

### ValidationPort

**File:** `src/ports/validation.port.ts`

Input/output validation.

## Tooling

### BundlerPort

**File:** `src/ports/bundler.port.ts`

Agent bundling for deployment.

### CompilerPort

**File:** `src/ports/compiler.port.ts`

TypeScript compilation.

### DeployerPort

**File:** `src/ports/deployer.port.ts`

Deployment automation.

### HotReloadPort

**File:** `src/ports/hot-reload.port.ts`

Hot module reload for development.

## Core

### DiPort

**File:** `src/ports/di.port.ts`

Dependency injection container.

### MiddlewarePort

**File:** `src/ports/middleware.port.ts`

Middleware interface.

### PluginPort

**File:** `src/ports/plugin.port.ts`

Plugin interface.

### PluginRegistryPort

**File:** `src/ports/plugin-registry.port.ts`

Plugin discovery and management.

### PluginManifestPort

**File:** `src/ports/plugin-manifest.port.ts`

Plugin metadata and manifest.

---

> **Tip:** Use the [DocGenerator](../../src/docs/doc-generator.ts) to auto-generate detailed API docs from source code with `npx ts-node src/docs/doc-generator.ts`.

## Related

- [Adapters API](./adapters.md) — adapter implementations
- [Architecture](../architecture.md) — hexagonal architecture
