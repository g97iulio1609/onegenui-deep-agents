import { describe, expect, it, beforeEach } from "vitest";

import { InMemoryAdvancedAgentMemoryAdapter } from "../memory.adapter.js";
import { cosineSimilarity } from "../similarity.js";
import type { MemoryEntry } from "../../../ports/advanced-agent-memory.port.js";

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    agentId: "agent-1",
    type: "short_term",
    content: "test content",
    importance: 0.5,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("InMemoryAdvancedAgentMemoryAdapter", () => {
  let adapter: InMemoryAdvancedAgentMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdvancedAgentMemoryAdapter();
  });

  // -------------------------------------------------------------------------
  // store
  // -------------------------------------------------------------------------

  it("1. store creates memory with auto-generated id", async () => {
    const id = await adapter.store(makeEntry());
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("2. store preserves custom id", async () => {
    const id = await adapter.store(makeEntry({ id: "custom-id" }));
    expect(id).toBe("custom-id");

    const results = await adapter.recall({ agentId: "agent-1" });
    expect(results[0]?.id).toBe("custom-id");
  });

  // -------------------------------------------------------------------------
  // recall — basic filters
  // -------------------------------------------------------------------------

  it("3. recall by agentId returns all memories for that agent", async () => {
    await adapter.store(makeEntry({ agentId: "agent-1", content: "A" }));
    await adapter.store(makeEntry({ agentId: "agent-1", content: "B" }));
    await adapter.store(makeEntry({ agentId: "agent-2", content: "C" }));

    const results = await adapter.recall({ agentId: "agent-1" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.agentId === "agent-1")).toBe(true);
  });

  it("4. recall by type filters correctly", async () => {
    await adapter.store(makeEntry({ type: "short_term", content: "S" }));
    await adapter.store(makeEntry({ type: "long_term", content: "L" }));
    await adapter.store(makeEntry({ type: "episodic", content: "E" }));

    const results = await adapter.recall({ agentId: "agent-1", type: "long_term" });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("L");
  });

  it("5. recall by tags filters correctly", async () => {
    await adapter.store(makeEntry({ content: "tagged", tags: ["important", "urgent"] }));
    await adapter.store(makeEntry({ content: "other", tags: ["low"] }));

    const results = await adapter.recall({ agentId: "agent-1", tags: ["important"] });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("tagged");
  });

  it("6. recall by text does keyword matching", async () => {
    await adapter.store(makeEntry({ content: "TypeScript is great" }));
    await adapter.store(makeEntry({ content: "Python is fun" }));

    const results = await adapter.recall({ agentId: "agent-1", text: "TypeScript" });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain("TypeScript");
  });

  it("7. recall by embedding uses cosine similarity", async () => {
    await adapter.store(makeEntry({ content: "vec-A", embedding: [1, 0, 0] }));
    await adapter.store(makeEntry({ content: "vec-B", embedding: [0, 1, 0] }));
    await adapter.store(makeEntry({ content: "vec-C", embedding: [0.9, 0.1, 0] }));

    const results = await adapter.recall({
      agentId: "agent-1",
      embedding: [1, 0, 0],
      limit: 3,
    });

    // vec-A (exact match) should rank higher than vec-C (close), vec-B (orthogonal)
    expect(results[0]?.content).toBe("vec-A");
    expect(results[1]?.content).toBe("vec-C");
  });

  it("8. recall with limit caps results", async () => {
    for (let i = 0; i < 10; i++) {
      await adapter.store(makeEntry({ content: `item-${i}` }));
    }

    const results = await adapter.recall({ agentId: "agent-1", limit: 3 });
    expect(results).toHaveLength(3);
  });

  it("9. recall with minImportance filters low importance", async () => {
    await adapter.store(makeEntry({ content: "high", importance: 0.9 }));
    await adapter.store(makeEntry({ content: "low", importance: 0.1 }));

    const results = await adapter.recall({ agentId: "agent-1", minImportance: 0.5 });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("high");
  });

  it("10. recall with since/before filters by time", async () => {
    const t1 = 1000;
    const t2 = 2000;
    const t3 = 3000;

    await adapter.store(makeEntry({ content: "old", timestamp: t1 }));
    await adapter.store(makeEntry({ content: "mid", timestamp: t2 }));
    await adapter.store(makeEntry({ content: "new", timestamp: t3 }));

    const results = await adapter.recall({ agentId: "agent-1", since: 1500, before: 2500 });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("mid");
  });

  // -------------------------------------------------------------------------
  // consolidate
  // -------------------------------------------------------------------------

  it("11. consolidate groups old short-term memories", async () => {
    const oldTs = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
    for (let i = 0; i < 5; i++) {
      await adapter.store(
        makeEntry({ type: "short_term", content: `old-${i}`, timestamp: oldTs + i }),
      );
    }

    const result = await adapter.consolidate("agent-1");
    expect(result.memoriesProcessed).toBe(5);
  });

  it("12. consolidate creates long-term summary", async () => {
    const oldTs = Date.now() - 2 * 60 * 60 * 1000;
    for (let i = 0; i < 3; i++) {
      await adapter.store(
        makeEntry({ type: "short_term", content: `fact-${i}`, timestamp: oldTs + i }),
      );
    }

    const result = await adapter.consolidate("agent-1");
    expect(result.memoriesCreated).toBeGreaterThanOrEqual(1);
    expect(result.summaries.length).toBeGreaterThanOrEqual(1);

    // Verify long-term entry was created
    const longTerm = await adapter.recall({ agentId: "agent-1", type: "long_term" });
    expect(longTerm.length).toBeGreaterThanOrEqual(1);
  });

  it("13. consolidate removes consolidated short-term", async () => {
    const oldTs = Date.now() - 2 * 60 * 60 * 1000;
    for (let i = 0; i < 3; i++) {
      await adapter.store(
        makeEntry({ type: "short_term", content: `to-remove-${i}`, timestamp: oldTs + i }),
      );
    }

    const result = await adapter.consolidate("agent-1");
    expect(result.memoriesRemoved).toBe(3);

    // Old short-term entries should be gone
    const remaining = await adapter.recall({ agentId: "agent-1", type: "short_term" });
    expect(remaining).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // stats
  // -------------------------------------------------------------------------

  it("14. stats returns correct counts by type", async () => {
    await adapter.store(makeEntry({ type: "short_term" }));
    await adapter.store(makeEntry({ type: "short_term" }));
    await adapter.store(makeEntry({ type: "long_term" }));
    await adapter.store(makeEntry({ type: "episodic" }));

    const s = await adapter.stats("agent-1");
    expect(s.total).toBe(4);
    expect(s.byType.short_term).toBe(2);
    expect(s.byType.long_term).toBe(1);
    expect(s.byType.episodic).toBe(1);
  });

  it("15. stats returns correct average importance", async () => {
    await adapter.store(makeEntry({ importance: 0.2 }));
    await adapter.store(makeEntry({ importance: 0.8 }));

    const s = await adapter.stats("agent-1");
    expect(s.averageImportance).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  it("16. clear by type removes only that type", async () => {
    await adapter.store(makeEntry({ type: "short_term", content: "S" }));
    await adapter.store(makeEntry({ type: "long_term", content: "L" }));

    const removed = await adapter.clear("agent-1", "short_term");
    expect(removed).toBe(1);

    const remaining = await adapter.recall({ agentId: "agent-1" });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.type).toBe("long_term");
  });

  it("17. clear all removes everything", async () => {
    await adapter.store(makeEntry({ type: "short_term" }));
    await adapter.store(makeEntry({ type: "long_term" }));
    await adapter.store(makeEntry({ type: "episodic" }));

    const removed = await adapter.clear("agent-1");
    expect(removed).toBe(3);

    const remaining = await adapter.recall({ agentId: "agent-1" });
    expect(remaining).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // scope
  // -------------------------------------------------------------------------

  it("18. scope store/recall uses correct namespaced agentId", async () => {
    const scoped = adapter.scope("agent-1", "project-x");

    await scoped.store({ type: "working", content: "scoped note" });

    const results = await scoped.recall({});
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("scoped note");
    expect(results[0]?.agentId).toBe("agent-1::project-x");

    // Not visible from the base agentId
    const base = await adapter.recall({ agentId: "agent-1" });
    expect(base).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // TTL / expiry
  // -------------------------------------------------------------------------

  it("19. expired memories are not returned", async () => {
    await adapter.store(makeEntry({ content: "alive", expiresAt: Date.now() + 60_000 }));
    await adapter.store(makeEntry({ content: "dead", expiresAt: Date.now() - 1 }));

    const results = await adapter.recall({ agentId: "agent-1" });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("alive");
  });

  // -------------------------------------------------------------------------
  // ordering
  // -------------------------------------------------------------------------

  it("20. importance ordering in results", async () => {
    await adapter.store(makeEntry({ content: "low", importance: 0.1, timestamp: 1 }));
    await adapter.store(makeEntry({ content: "high", importance: 0.9, timestamp: 2 }));
    await adapter.store(makeEntry({ content: "mid", importance: 0.5, timestamp: 3 }));

    const results = await adapter.recall({ agentId: "agent-1", limit: 3 });
    expect(results[0]?.content).toBe("high");
    expect(results[1]?.content).toBe("mid");
    expect(results[2]?.content).toBe("low");
  });

  // -------------------------------------------------------------------------
  // cosine similarity (unit)
  // -------------------------------------------------------------------------

  it("21. cosine similarity returns correct ranking", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  // -------------------------------------------------------------------------
  // edge cases
  // -------------------------------------------------------------------------

  it("22. empty recall returns empty array", async () => {
    const results = await adapter.recall({ agentId: "nonexistent" });
    expect(results).toEqual([]);
  });

  it("23. store auto-sets timestamp when not provided", async () => {
    const before = Date.now();
    const id = await adapter.store({
      agentId: "agent-1",
      type: "working",
      content: "no ts",
    });
    const after = Date.now();

    const results = await adapter.recall({ agentId: "agent-1" });
    const entry = results.find((r) => r.id === id);
    expect(entry).toBeDefined();
    expect(entry!.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry!.timestamp).toBeLessThanOrEqual(after);
  });

  it("24. scoped clear removes only scoped entries", async () => {
    const scoped = adapter.scope("agent-1", "ns");
    await scoped.store({ type: "working", content: "scoped" });
    await adapter.store(makeEntry({ content: "unscoped" }));

    const removed = await scoped.clear();
    expect(removed).toBe(1);

    // Unscoped entry still present
    const base = await adapter.recall({ agentId: "agent-1" });
    expect(base).toHaveLength(1);
    expect(base[0]?.content).toBe("unscoped");
  });

  it("25. recall with multiple tags requires all tags present", async () => {
    await adapter.store(makeEntry({ content: "both", tags: ["a", "b"] }));
    await adapter.store(makeEntry({ content: "only-a", tags: ["a"] }));

    const results = await adapter.recall({ agentId: "agent-1", tags: ["a", "b"] });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("both");
  });
});
