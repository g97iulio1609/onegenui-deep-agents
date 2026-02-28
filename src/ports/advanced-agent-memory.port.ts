// =============================================================================
// AdvancedAgentMemoryPort — Production-grade agent memory contract
// Supports short-term, long-term, episodic, semantic, and working memory
// with consolidation, scoping, TTL, and importance-weighted recall.
// =============================================================================

export type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'working';

export interface AgentMemoryPort {
  /** Store a memory entry, returns the assigned id */
  store(entry: MemoryEntry): Promise<string>;

  /** Recall memories matching a query */
  recall(query: MemoryQuery): Promise<MemoryEntry[]>;

  /** Consolidate old short-term memories into long-term summaries */
  consolidate(agentId: string): Promise<ConsolidationResult>;

  /** Get memory statistics for an agent */
  stats(agentId: string): Promise<MemoryStats>;

  /** Clear memories by type or all, returns count of removed entries */
  clear(agentId: string, type?: MemoryType): Promise<number>;

  /** Create a scoped (namespaced) memory view for a given agent */
  scope(agentId: string, scopeName: string): ScopedMemory;
}

export interface MemoryEntry {
  id?: string;
  agentId: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  importance?: number; // 0-1, for prioritized recall
  timestamp?: number;
  expiresAt?: number;
  tags?: string[];
}

export interface MemoryQuery {
  agentId: string;
  type?: MemoryType;
  text?: string;
  embedding?: number[];
  tags?: string[];
  limit?: number;
  minImportance?: number;
  since?: number;
  before?: number;
}

export interface ConsolidationResult {
  memoriesProcessed: number;
  memoriesCreated: number;
  memoriesRemoved: number;
  summaries: string[];
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  oldestTimestamp: number;
  newestTimestamp: number;
  averageImportance: number;
}

export interface ScopedMemory {
  store(entry: Omit<MemoryEntry, 'agentId'>): Promise<string>;
  recall(query: Omit<MemoryQuery, 'agentId'>): Promise<MemoryEntry[]>;
  clear(type?: MemoryType): Promise<number>;
}
