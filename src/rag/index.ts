// =============================================================================
// RAG — Public API (sub-entry point: gauss-ai/rag)
// =============================================================================

// Pipelines
export { RAGPipeline } from "./pipeline.js";
export { GraphRAGPipeline } from "./graph-rag.pipeline.js";
export type { GraphRAGConfig, GraphIngestResult, GraphQueryResult } from "./graph-rag.pipeline.js";

// Adapters
export { InMemoryEmbeddingAdapter } from "../adapters/embedding/inmemory.adapter.js";
export { InMemoryVectorStore } from "../adapters/vector-store/inmemory.adapter.js";
export { MarkdownDocumentAdapter } from "../adapters/document/markdown.adapter.js";
export { InMemoryKnowledgeGraphAdapter } from "../adapters/knowledge-graph/inmemory.adapter.js";
export { PatternEntityExtractorAdapter, DEFAULT_ENTITY_PATTERNS } from "../adapters/entity-extractor/pattern.adapter.js";
export type { PatternRule, RelationPattern, PatternEntityExtractorConfig } from "../adapters/entity-extractor/pattern.adapter.js";

// Port types
export type { EmbeddingPort } from "../ports/embedding.port.js";
export type { VectorStorePort } from "../ports/vector-store.port.js";
export type { DocumentPort } from "../ports/document.port.js";
export type { KnowledgeGraphPort, GraphNode, GraphEdge, GraphQueryOptions, SubgraphResult } from "../ports/knowledge-graph.port.js";
export type { EntityExtractorPort, Entity, Relation, ExtractionResult } from "../ports/entity-extractor.port.js";
export type { ChunkingPort, ChunkOptions, Chunk } from "../ports/chunking.port.js";
export type { ReRankingPort, ReRankingOptions, ScoredResult, SourceAttribution } from "../ports/reranking.port.js";
