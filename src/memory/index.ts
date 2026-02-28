// =============================================================================
// Memory — Public API (sub-entry point: gauss-ai/memory)
// =============================================================================

// Memory adapters
export { InMemoryAdapter } from "../adapters/memory/in-memory.adapter.js";
export { InMemoryAgentMemoryAdapter } from "../adapters/memory/in-memory-agent-memory.adapter.js";
export type { InMemoryAgentMemoryOptions } from "../adapters/memory/in-memory-agent-memory.adapter.js";
export { TieredAgentMemoryAdapter } from "../adapters/memory/tiered-agent-memory.adapter.js";
export type { TieredAgentMemoryAdapterOptions } from "../adapters/memory/tiered-agent-memory.adapter.js";
export { SupabaseMemoryAdapter } from "../adapters/memory/supabase.adapter.js";

// Advanced agent memory
export {
  InMemoryAdvancedAgentMemoryAdapter,
  cosineSimilarity,
  consolidateMemories,
} from "../adapters/agent-memory/index.js";
export type { InMemoryAgentMemoryAdapterOptions, ConsolidatorOptions } from "../adapters/agent-memory/index.js";

// Working memory
export { InMemoryWorkingMemory } from "../adapters/working-memory/inmemory.adapter.js";

// Memory plugin
export { MemoryPlugin, createMemoryPlugin } from "../plugins/memory.plugin.js";
export type { MemoryPluginOptions } from "../plugins/memory.plugin.js";

// Port types
export type { MemoryPort } from "../ports/memory.port.js";
export type {
  AgentMemoryPort,
  MemoryEntry,
  MemoryTier,
  MemoryStats,
  RecallOptions,
} from "../ports/agent-memory.port.js";
export type { WorkingMemoryPort } from "../ports/working-memory.port.js";
export type {
  AgentMemoryPort as AdvancedAgentMemoryPort,
  MemoryType,
  MemoryEntry as AdvancedMemoryEntry,
  MemoryQuery,
  ConsolidationResult,
  MemoryStats as AdvancedMemoryStats,
  ScopedMemory,
} from "../ports/advanced-agent-memory.port.js";
