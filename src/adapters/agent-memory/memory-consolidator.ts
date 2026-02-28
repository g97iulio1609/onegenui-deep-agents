// =============================================================================
// Memory Consolidator — Summarises old short-term memories into long-term
// =============================================================================

import type {
  MemoryEntry,
  ConsolidationResult,
} from "../../ports/advanced-agent-memory.port.js";

/** Default age threshold: memories older than 1 hour are eligible */
const DEFAULT_AGE_MS = 60 * 60 * 1_000;

/** Maximum number of short-term entries combined into a single summary */
const BATCH_SIZE = 10;

/** Maximum length (chars) of a generated summary */
const SUMMARY_MAX_LENGTH = 500;

export interface ConsolidatorOptions {
  /** Milliseconds a short-term memory must be old before consolidation */
  ageThresholdMs?: number;
  /** Maximum entries per summary batch */
  batchSize?: number;
}

/**
 * Identify eligible short-term memories, group them into batches, and
 * produce long-term summary entries.
 *
 * Returns the consolidation result **plus** the list of new entries to store
 * and the ids of old entries to remove.
 */
export function consolidateMemories(
  entries: MemoryEntry[],
  agentId: string,
  options: ConsolidatorOptions = {},
): {
  result: ConsolidationResult;
  toStore: MemoryEntry[];
  toRemove: string[];
} {
  const ageThreshold = options.ageThresholdMs ?? DEFAULT_AGE_MS;
  const batchSize = options.batchSize ?? BATCH_SIZE;
  const now = Date.now();

  // Filter eligible short-term memories
  const eligible = entries.filter(
    (e) =>
      e.type === "short_term" &&
      e.agentId === agentId &&
      e.id !== undefined &&
      (e.timestamp ?? 0) < now - ageThreshold,
  );

  if (eligible.length === 0) {
    return {
      result: { memoriesProcessed: 0, memoriesCreated: 0, memoriesRemoved: 0, summaries: [] },
      toStore: [],
      toRemove: [],
    };
  }

  // Sort by timestamp ascending for chronological grouping
  eligible.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  const toStore: MemoryEntry[] = [];
  const toRemove: string[] = [];
  const summaries: string[] = [];

  for (let i = 0; i < eligible.length; i += batchSize) {
    const batch = eligible.slice(i, i + batchSize);
    const combined = batch.map((e) => e.content).join("\n");
    const summary =
      combined.length > SUMMARY_MAX_LENGTH
        ? combined.slice(0, SUMMARY_MAX_LENGTH) + "…"
        : combined;

    summaries.push(summary);
    toStore.push({
      agentId,
      type: "long_term",
      content: summary,
      importance: averageImportance(batch),
      timestamp: now,
      metadata: { consolidatedFrom: batch.map((e) => e.id) },
      tags: [...new Set(batch.flatMap((e) => e.tags ?? []))],
    });

    for (const e of batch) {
      if (e.id) toRemove.push(e.id);
    }
  }

  return {
    result: {
      memoriesProcessed: eligible.length,
      memoriesCreated: toStore.length,
      memoriesRemoved: toRemove.length,
      summaries,
    },
    toStore,
    toRemove,
  };
}

function averageImportance(entries: MemoryEntry[]): number {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, e) => acc + (e.importance ?? 0.5), 0);
  return Math.round((sum / entries.length) * 100) / 100;
}
