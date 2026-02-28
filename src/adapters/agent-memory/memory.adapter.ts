// =============================================================================
// InMemoryAgentMemoryAdapter — In-memory implementation of AdvancedAgentMemoryPort
// =============================================================================

import type {
  AgentMemoryPort,
  MemoryEntry,
  MemoryQuery,
  MemoryType,
  MemoryStats,
  ConsolidationResult,
  ScopedMemory,
} from "../../ports/advanced-agent-memory.port.js";
import { cosineSimilarity } from "./similarity.js";
import { consolidateMemories, type ConsolidatorOptions } from "./memory-consolidator.js";

export interface InMemoryAgentMemoryAdapterOptions {
  /** Max total entries kept in storage (LRU eviction) */
  maxEntries?: number;
  /** Options forwarded to the consolidator */
  consolidator?: ConsolidatorOptions;
}

export class InMemoryAdvancedAgentMemoryAdapter implements AgentMemoryPort {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly maxEntries: number;
  private readonly consolidatorOpts: ConsolidatorOptions;
  private counter = 0;

  constructor(options: InMemoryAgentMemoryAdapterOptions = {}) {
    this.maxEntries = options.maxEntries ?? 50_000;
    this.consolidatorOpts = options.consolidator ?? {};
  }

  // ---------------------------------------------------------------------------
  // store
  // ---------------------------------------------------------------------------

  async store(entry: MemoryEntry): Promise<string> {
    const id = entry.id ?? this.generateId();
    const now = Date.now();
    const stored: MemoryEntry = {
      ...entry,
      id,
      timestamp: entry.timestamp ?? now,
    };

    this.entries.set(id, stored);
    this.evictIfNeeded();

    return id;
  }

  // ---------------------------------------------------------------------------
  // recall
  // ---------------------------------------------------------------------------

  async recall(query: MemoryQuery): Promise<MemoryEntry[]> {
    const now = Date.now();
    const limit = query.limit ?? 20;

    type Scored = { entry: MemoryEntry; score: number };
    const candidates: Scored[] = [];

    for (const entry of this.entries.values()) {
      // Agent filter
      if (entry.agentId !== query.agentId) continue;

      // TTL check
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) continue;

      // Type filter
      if (query.type !== undefined && entry.type !== query.type) continue;

      // Importance filter
      if (query.minImportance !== undefined && (entry.importance ?? 0) < query.minImportance) continue;

      // Time filters
      if (query.since !== undefined && (entry.timestamp ?? 0) < query.since) continue;
      if (query.before !== undefined && (entry.timestamp ?? 0) >= query.before) continue;

      // Tag filter (all query tags must be present)
      if (query.tags && query.tags.length > 0) {
        const entryTags = new Set(entry.tags ?? []);
        if (!query.tags.every((t) => entryTags.has(t))) continue;
      }

      // Scoring
      let score = entry.importance ?? 0.5;

      // Semantic similarity (embedding)
      if (query.embedding && entry.embedding) {
        const sim = cosineSimilarity(query.embedding, entry.embedding);
        score = sim * 0.7 + (entry.importance ?? 0.5) * 0.3;
      }

      // Keyword matching (text)
      if (query.text) {
        const textScore = this.keywordScore(query.text, entry.content);
        if (textScore === 0 && !query.embedding) continue; // no match, skip
        score = query.embedding
          ? score * 0.6 + textScore * 0.4
          : textScore * 0.7 + (entry.importance ?? 0.5) * 0.3;
      }

      candidates.push({ entry, score });
    }

    // Sort by score descending, then by timestamp descending
    candidates.sort((a, b) => {
      const ds = b.score - a.score;
      if (Math.abs(ds) > 1e-9) return ds;
      return (b.entry.timestamp ?? 0) - (a.entry.timestamp ?? 0);
    });

    return candidates.slice(0, limit).map((c) => ({ ...c.entry }));
  }

  // ---------------------------------------------------------------------------
  // consolidate
  // ---------------------------------------------------------------------------

  async consolidate(agentId: string): Promise<ConsolidationResult> {
    const allEntries = Array.from(this.entries.values());

    const { result, toStore, toRemove } = consolidateMemories(
      allEntries,
      agentId,
      this.consolidatorOpts,
    );

    for (const id of toRemove) {
      this.entries.delete(id);
    }

    for (const entry of toStore) {
      const id = entry.id ?? this.generateId();
      this.entries.set(id, { ...entry, id });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // stats
  // ---------------------------------------------------------------------------

  async stats(agentId: string): Promise<MemoryStats> {
    const byType: Record<MemoryType, number> = {
      short_term: 0,
      long_term: 0,
      episodic: 0,
      semantic: 0,
      working: 0,
    };
    let total = 0;
    let oldest = Infinity;
    let newest = -Infinity;
    let importanceSum = 0;
    let importanceCount = 0;

    for (const entry of this.entries.values()) {
      if (entry.agentId !== agentId) continue;
      total++;
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;

      const ts = entry.timestamp ?? 0;
      if (ts < oldest) oldest = ts;
      if (ts > newest) newest = ts;

      importanceSum += entry.importance ?? 0;
      importanceCount++;
    }

    return {
      total,
      byType,
      oldestTimestamp: total > 0 ? oldest : 0,
      newestTimestamp: total > 0 ? newest : 0,
      averageImportance:
        importanceCount > 0
          ? Math.round((importanceSum / importanceCount) * 100) / 100
          : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  async clear(agentId: string, type?: MemoryType): Promise<number> {
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (entry.agentId !== agentId) continue;
      if (type !== undefined && entry.type !== type) continue;
      this.entries.delete(id);
      removed++;
    }
    return removed;
  }

  // ---------------------------------------------------------------------------
  // scope
  // ---------------------------------------------------------------------------

  scope(agentId: string, scopeName: string): ScopedMemory {
    const scopedAgentId = `${agentId}::${scopeName}`;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const adapter = this;

    return {
      async store(entry: Omit<MemoryEntry, 'agentId'>): Promise<string> {
        return adapter.store({ ...entry, agentId: scopedAgentId });
      },
      async recall(query: Omit<MemoryQuery, 'agentId'>): Promise<MemoryEntry[]> {
        return adapter.recall({ ...query, agentId: scopedAgentId });
      },
      async clear(type?: MemoryType): Promise<number> {
        return adapter.clear(scopedAgentId, type);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private generateId(): string {
    this.counter++;
    return `mem_${Date.now()}_${this.counter}`;
  }

  private evictIfNeeded(): void {
    if (this.entries.size <= this.maxEntries) return;

    // Evict oldest entries first
    const sorted = Array.from(this.entries.entries()).sort(
      ([, a], [, b]) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
    );

    const toRemove = sorted.slice(0, this.entries.size - this.maxEntries);
    for (const [id] of toRemove) {
      this.entries.delete(id);
    }
  }

  private keywordScore(text: string, content: string): number {
    const queryWords = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return 0;

    const lowerContent = content.toLowerCase();
    let matches = 0;

    for (const word of queryWords) {
      if (lowerContent.includes(word)) matches++;
    }

    return matches / queryWords.length;
  }
}
