/**
 * Unit tests for Memory, VectorStore, and other data SDK modules.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("gauss-napi", () => ({
  create_memory: vi.fn(() => 1),
  memory_store: vi.fn(async () => undefined),
  memory_recall: vi.fn(async () => [
    { role: "user", content: "Hello", sessionId: "s1" },
  ]),
  memory_clear: vi.fn(async () => undefined),
  memory_stats: vi.fn(async () => ({ totalEntries: 5 })),
  destroy_memory: vi.fn(),

  create_vector_store: vi.fn(() => 2),
  vector_store_upsert: vi.fn(async () => undefined),
  vector_store_search: vi.fn(async () => [
    { id: "c1", text: "chunk", score: 0.95 },
  ]),
  destroy_vector_store: vi.fn(),
  cosine_similarity: vi.fn(() => 0.98),
}));

import { Memory } from "../memory.js";
import { VectorStore } from "../vector-store.js";
import { memory_store, memory_recall, memory_clear, destroy_memory } from "gauss-napi";

beforeEach(() => vi.clearAllMocks());

describe("Memory", () => {
  it("stores and recalls entries", async () => {
    const mem = new Memory();
    await mem.store({
      id: "m1", content: "Hi", entryType: "conversation", timestamp: "2024-01-01T00:00:00Z", sessionId: "s1",
    });
    expect(memory_store).toHaveBeenCalledWith(
      1,
      expect.stringContaining('"id":"m1"')
    );

    const entries = await mem.recall({ sessionId: "s1" });
    expect(entries).toHaveLength(1);
    mem.destroy();
  });

  it("supports shorthand store(entryType, content, sessionId)", async () => {
    const mem = new Memory();
    await mem.store("conversation", "World", "s2");
    expect(memory_store).toHaveBeenCalledWith(
      1,
      expect.stringContaining('"content":"World"')
    );
    mem.destroy();
  });

  it("clears by session", async () => {
    const mem = new Memory();
    await mem.clear("s1");
    expect(memory_clear).toHaveBeenCalledWith(1, "s1");
    mem.destroy();
  });

  it("returns stats", async () => {
    const mem = new Memory();
    const stats = await mem.stats();
    expect(stats.totalEntries).toBe(5);
    mem.destroy();
  });

  it("throws after destroy", async () => {
    const mem = new Memory();
    mem.destroy();
    await expect(mem.store({
      id: "x", content: "x", entryType: "conversation", timestamp: "2024-01-01T00:00:00Z",
    })).rejects.toThrow(
      "Memory has been destroyed"
    );
  });

  it("Symbol.dispose works", () => {
    const mem = new Memory();
    mem[Symbol.dispose]();
    expect(destroy_memory).toHaveBeenCalledOnce();
  });
});

describe("VectorStore", () => {
  it("upserts and searches", async () => {
    const store = new VectorStore();
    await store.upsert([
      { id: "c1", documentId: "d1", content: "hello", index: 0, embedding: [0.1, 0.2] },
    ]);
    const results = await store.search([0.1, 0.2], 5);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.95);
    store.destroy();
  });

  it("computes cosine similarity", () => {
    expect(VectorStore.cosineSimilarity([1, 0], [1, 0])).toBe(0.98);
  });
});
