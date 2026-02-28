# Adapters API Reference

Adapters implement port interfaces with concrete backends. All adapters live in `src/adapters/<name>/`.

## Storage

### Vector Store Adapters

**Directory:** `src/adapters/vector-store/`  
**Port:** `VectorStorePort`

| Adapter | Description |
|---------|-------------|
| `InMemoryVectorStore` | In-memory store for development/testing |
| `PineconeVectorStore` | Pinecone managed vector database |
| `PgvectorStore` | PostgreSQL pgvector extension |
| `QdrantVectorStore` | Qdrant vector search engine |
| `WeaviateVectorStore` | Weaviate AI-native database |
| `ChromaVectorStore` | Chroma embedding database |
| `MilvusVectorStore` | Milvus scalable vector database |
| `SupabaseVectorStore` | Supabase pgvector integration |
| + 20 more | See `src/adapters/vector-store/` |

### Memory Adapters

**Directory:** `src/adapters/memory/`  
**Port:** `MemoryPort`

### Working Memory Adapters

**Directory:** `src/adapters/working-memory/`  
**Port:** `WorkingMemoryPort`

### Object Storage Adapters

**Directory:** `src/adapters/object-storage/`  
**Port:** `ObjectStoragePort`

### Storage Adapters

**Directory:** `src/adapters/storage/`  
**Port:** `StorageDomainPort`

## Observability

### Telemetry Adapters

**Directory:** `src/adapters/telemetry/`  
**Port:** `TelemetryPort`

| Adapter | Description |
|---------|-------------|
| `ConsoleTelemetryAdapter` | Console-based telemetry (zero deps) |
| `OtelTelemetryAdapter` | OpenTelemetry integration |
| `LangfuseTelemetryAdapter` | Langfuse observability |
| `LangsmithTelemetryAdapter` | LangSmith integration |
| `DatadogTelemetryAdapter` | Datadog APM |
| `SentryTelemetryAdapter` | Sentry error tracking |
| + 6 more | See `src/adapters/telemetry/` |

### Tracing Adapters

**Directory:** `src/adapters/tracing/`  
**Port:** `TracingPort`

### Metrics Adapters

**Directory:** `src/adapters/metrics/`  
**Port:** `MetricsPort`

### Logging Adapters

**Directory:** `src/adapters/logging/`  
**Port:** `LoggingPort`

### Cost Tracker Adapters

**Directory:** `src/adapters/cost-tracker/`  
**Port:** `CostTrackerPort`

### Token Counter Adapters

**Directory:** `src/adapters/token-counter/`  
**Port:** `TokenCounterPort`

## Security

### Auth Adapters

**Directory:** `src/adapters/auth/`  
**Port:** `AuthPort`

| Adapter | Description |
|---------|-------------|
| `JwtAuthAdapter` | JSON Web Token authentication |
| `SupabaseAuthAdapter` | Supabase Auth integration |
| `ApiKeyAuthAdapter` | Simple API key authentication |
| + 2 more | See `src/adapters/auth/` |

### Policy Adapters

**Directory:** `src/adapters/policy/`  
**Port:** `PolicyPort`

### Sandbox Adapters

**Directory:** `src/adapters/sandbox/`  
**Port:** `SandboxPort`

## AI / ML

### Model Adapters

**Directory:** `src/adapters/model/`  
**Port:** `ModelPort`

### Embedding Adapters

**Directory:** `src/adapters/embedding/`  
**Port:** `EmbeddingPort`

### Reranking Adapters

**Directory:** `src/adapters/reranking/`  
**Port:** `RerankingPort`

### Entity Extractor Adapters

**Directory:** `src/adapters/entity-extractor/`  
**Port:** `EntityExtractorPort`

### Knowledge Graph Adapters

**Directory:** `src/adapters/knowledge-graph/`  
**Port:** `KnowledgeGraphPort`

### Learning Adapters

**Directory:** `src/adapters/learning/`  
**Port:** `LearningPort`

### Datasets Adapters

**Directory:** `src/adapters/datasets/`  
**Port:** `DatasetsPort`

## I/O

### Voice Adapters

**Directory:** `src/adapters/voice/`  
**Port:** `VoicePort`

| Adapter | Description |
|---------|-------------|
| `ElevenLabsVoiceAdapter` | ElevenLabs TTS |
| `WhisperVoiceAdapter` | OpenAI Whisper STT |
| `AzureVoiceAdapter` | Azure Cognitive Services |
| + 9 more | See `src/adapters/voice/` |

### Semantic Scraping Adapters

**Directory:** `src/adapters/semantic-scraping/`  
**Port:** `SemanticScrapingPort`

### Filesystem Adapters

**Directory:** `src/adapters/filesystem/`  
**Port:** `FilesystemPort`

## Infrastructure

### Server Adapters

**Directory:** `src/adapters/server/`  
**Port:** `ServerPort`

| Adapter | Description |
|---------|-------------|
| `McpServer` | Model Context Protocol server |
| `StreamableHttpHandler` | HTTP with streaming |
| `PlaygroundAPI` | Interactive playground |
| `WebSocketServer` | WebSocket server |

### MCP Adapters

**Directory:** `src/adapters/mcp/`  
**Port:** `McpPort`

### MCP Server Adapters

**Directory:** `src/adapters/mcp-server/`  
**Port:** `McpServerPort`

### ACP Adapters

**Directory:** `src/adapters/acp/`  
**Port:** `AcpPort`

### Runtime Adapters

**Directory:** `src/adapters/runtime/`  
**Port:** `RuntimePort`

### Queue Adapters

**Directory:** `src/adapters/queue/`  
**Port:** `QueuePort`

### Save Queue Adapters

**Directory:** `src/adapters/save-queue/`  
**Port:** `SaveQueuePort`

## Orchestration

### Workflow Adapters

**Directory:** `src/adapters/workflow/`  
**Port:** `WorkflowPort`

### Agent Network Adapters

**Directory:** `src/adapters/agent-network/`  
**Port:** `AgentNetworkPort`

### Consensus Adapters

**Directory:** `src/adapters/consensus/`  
**Port:** `ConsensusPort`

### Suspension Adapters

**Directory:** `src/adapters/suspension/`  
**Port:** `SuspensionPort`

### Skills Adapters

**Directory:** `src/adapters/skills/`  
**Port:** `SkillsPort`

## Tooling

### Bundler Adapters

**Directory:** `src/adapters/bundler/`  
**Port:** `BundlerPort`

### Compiler Adapters

**Directory:** `src/adapters/compiler/`  
**Port:** `CompilerPort`

### Deployer Adapters

**Directory:** `src/adapters/deployer/`  
**Port:** `DeployerPort`

## Special

### Composite Backend

**Directory:** `src/adapters/composite-backend/`

Combines multiple backends into a single unified adapter with fallback and routing.

### Execution Replay

**Directory:** `src/adapters/execution-replay/`

Records and replays agent executions for testing and debugging.

### Resilience

**Directory:** `src/adapters/resilience/`

Circuit breaker, retry, and rate limiting implementations.

### Type Builder

**Directory:** `src/adapters/type-builder/`

Runtime type construction for dynamic schemas.

### Codemod

**Directory:** `src/adapters/codemod/`

Automated code transformations.

---

## Related

- [Ports API](./ports.md) — port interface definitions
- [Architecture](../architecture.md) — adapter pattern design
