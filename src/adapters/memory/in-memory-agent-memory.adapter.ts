// =============================================================================
// InMemoryAgentMemoryAdapter — In-memory implementation of AgentMemoryPort
// =============================================================================

import type {
  AgentMemoryPort,
  MemoryEntry,
  RecallOptions,
  MemoryStats,
} from "../../ports/agent-memory.port.js";
import { calculateMemoryStats } from "./memory-utils.js";

export interface InMemoryAgentMemoryOptions {
  maxEntries?: number; // default 10000
}

export class InMemoryAgentMemoryAdapter implements AgentMemoryPort {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly insertionOrder = new Map<string, true>();
  private readonly maxEntries: number;

  constructor(options: InMemoryAgentMemoryOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  async store(entry: MemoryEntry): Promise<void> {
    // Delete + re-insert for LRU ordering (Map preserves insertion order)
    this.insertionOrder.delete(entry.id);
    this.insertionOrder.set(entry.id, true);

    this.entries.set(entry.id, { ...entry });

    // LRU eviction
    while (this.insertionOrder.size > this.maxEntries) {
      const oldest = this.insertionOrder.keys().next().value;
      if (oldest !== undefined) {
        this.insertionOrder.delete(oldest);
        this.entries.delete(oldest);
      }
    }
  }

  async recall(_query: string, options: RecallOptions = {}): Promise<MemoryEntry[]> {
    const { limit = 10, type, sessionId, minImportance, query } = options;
    let results = Array.from(this.entries.values());

    if (type) {
      results = results.filter((e) => e.type === type);
    }
    if (sessionId) {
      results = results.filter((e) => e.sessionId === sessionId);
    }
    if (minImportance !== undefined) {
      results = results.filter((e) => (e.importance ?? 0) >= minImportance);
    }
    if (query) {
      const lower = query.toLowerCase();
      results = results.filter((e) => e.content.toLowerCase().includes(lower));
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return results.slice(0, limit);
  }

  async summarize(entries: MemoryEntry[]): Promise<string> {
    const combined = entries.map((e) => e.content).join("\n");
    return combined.length > 500 ? combined.slice(0, 500) + "..." : combined;
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.insertionOrder.clear();
  }

  async getStats(): Promise<MemoryStats> {
    return calculateMemoryStats(this.entries.values());
  }
}
