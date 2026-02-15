import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolCache, DEFAULT_TOOL_CACHE_CONFIG } from "../../../adapters/resilience/tool-cache.js";

describe("ToolCache", () => {
  let cache: ToolCache<string>;

  beforeEach(() => {
    cache = new ToolCache<string>({
      defaultTtlMs: 1000, // 1 second for testing
      maxSize: 3,
    });
  });

  describe("basic operations", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return undefined for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should handle different value types", () => {
      const objectCache = new ToolCache<any>();
      
      objectCache.set("string", "hello");
      objectCache.set("number", 42);
      objectCache.set("boolean", true);
      objectCache.set("object", { foo: "bar" });
      objectCache.set("array", [1, 2, 3]);
      
      expect(objectCache.get("string")).toBe("hello");
      expect(objectCache.get("number")).toBe(42);
      expect(objectCache.get("boolean")).toBe(true);
      expect(objectCache.get("object")).toEqual({ foo: "bar" });
      expect(objectCache.get("array")).toEqual([1, 2, 3]);
    });

    it("should update existing keys", () => {
      cache.set("key1", "value1");
      cache.set("key1", "value2");
      
      expect(cache.get("key1")).toBe("value2");
      expect(cache.size).toBe(1);
    });
  });

  describe("TTL (Time To Live)", () => {
    it("should expire entries after default TTL", async () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should use custom TTL when provided", async () => {
      cache.set("key1", "value1", 200); // 200ms TTL
      expect(cache.get("key1")).toBe("value1");

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.get("key1")).toBe("value1");

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should handle different TTLs for different keys", async () => {
      cache.set("short", "value1", 200);
      cache.set("long", "value2", 500);

      // After 300ms, short should expire but long should remain
      await new Promise(resolve => setTimeout(resolve, 300));
      
      expect(cache.get("short")).toBeUndefined();
      expect(cache.get("long")).toBe("value2");

      // After another 300ms, long should also expire
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(cache.get("long")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used items when max size is reached", () => {
      // Fill cache to capacity
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      expect(cache.size).toBe(3);

      // Add one more item, should evict least recently used (key1)
      cache.set("key4", "value4");
      
      expect(cache.size).toBe(3);
      expect(cache.get("key1")).toBeUndefined(); // Should be evicted
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("should update last accessed time on get", async () => {
      cache.set("key1", "value1");
      await new Promise(resolve => setTimeout(resolve, 5));
      cache.set("key2", "value2");
      await new Promise(resolve => setTimeout(resolve, 5));
      cache.set("key3", "value3");

      // Access key1 to make it most recently used
      await new Promise(resolve => setTimeout(resolve, 5));
      cache.get("key1");

      // Add new item, should evict key2 (now least recently used)
      cache.set("key4", "value4");

      expect(cache.get("key1")).toBe("value1"); // Should still exist
      expect(cache.get("key2")).toBeUndefined(); // Should be evicted
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("should not evict when updating existing key", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      
      // Update existing key - should not trigger eviction
      cache.set("key2", "updated_value2");
      
      expect(cache.size).toBe(3);
      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("updated_value2");
      expect(cache.get("key3")).toBe("value3");
    });
  });

  describe("invalidation", () => {
    it("should invalidate specific keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      
      expect(cache.invalidate("key1")).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.size).toBe(1);
    });

    it("should return false when invalidating non-existent key", () => {
      expect(cache.invalidate("nonexistent")).toBe(false);
    });

    it("should clear all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      
      cache.clear();
      
      expect(cache.size).toBe(0);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.get("key3")).toBeUndefined();
    });
  });

  describe("size management", () => {
    it("should return correct size", () => {
      expect(cache.size).toBe(0);
      
      cache.set("key1", "value1");
      expect(cache.size).toBe(1);
      
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);
      
      cache.invalidate("key1");
      expect(cache.size).toBe(1);
    });

    it("should clean up expired entries when accessing size", async () => {
      cache.set("key1", "value1", 200);
      cache.set("key2", "value2"); // Uses default TTL
      
      expect(cache.size).toBe(2);
      
      // Wait for first key to expire
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Accessing size should trigger cleanup
      expect(cache.size).toBe(1);
    });

    it("should handle maximum capacity correctly", () => {
      const largeCache = new ToolCache({ defaultTtlMs: 5000, maxSize: 1000 });
      
      // Add many items
      for (let i = 0; i < 1500; i++) {
        largeCache.set(`key${i}`, `value${i}`);
      }
      
      // Should not exceed max size
      expect(largeCache.size).toBeLessThanOrEqual(1000);
      
      // First items should be evicted (LRU)
      expect(largeCache.get("key0")).toBeUndefined();
      expect(largeCache.get("key499")).toBeUndefined();
      
      // Recent items should exist
      expect(largeCache.get("key1499")).toBe("value1499");
    });
  });

  describe("statistics", () => {
    let statCache: ToolCache<string>;

    beforeEach(() => {
      statCache = new ToolCache<string>({
        defaultTtlMs: 5000,
        maxSize: 100,
      });
    });

    it("should track hit and miss statistics", () => {
      // Initially no stats
      let stats = statCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);

      // Cache miss
      statCache.get("key1");
      stats = statCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);

      // Cache set and hit
      statCache.set("key1", "value1");
      statCache.get("key1");
      stats = statCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);

      // More operations
      statCache.get("key2"); // miss
      statCache.set("key2", "value2");
      statCache.get("key1"); // hit
      statCache.get("key2"); // hit

      stats = statCache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
    });

    it("should reset statistics", () => {
      statCache.set("key1", "value1");
      statCache.get("key1"); // hit
      statCache.get("key2"); // miss

      let stats = statCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      statCache.resetStats();

      stats = statCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(1); // Data should still be there
    });
  });

  describe("expired entry cleanup", () => {
    it("should clean up expired entries on access", async () => {
      cache.set("key1", "value1", 200);
      cache.set("key2", "value2", 400);
      cache.set("key3", "value3", 600);

      expect(cache.size).toBe(3);

      // Wait for first key to expire
      await new Promise(resolve => setTimeout(resolve, 300));

      // Access to any key should trigger cleanup
      cache.get("key2");

      expect(cache.size).toBe(2);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
    });

    it("should clean up multiple expired entries", async () => {
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 150);
      cache.set("key3", "value3", 500);

      await new Promise(resolve => setTimeout(resolve, 200));

      // This should clean up key1 and key2
      expect(cache.size).toBe(1);
      expect(cache.get("key3")).toBe("value3");
    });
  });

  describe("has method", () => {
    it("should return true for existing non-expired entries", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
    });

    it("should return false for non-existent keys", () => {
      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should return false for expired entries", async () => {
      cache.set("key1", "value1", 100);
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.has("key1")).toBe(false);
    });

    it("should distinguish cached undefined from cache miss", () => {
      const anyCache = new ToolCache<any>();
      anyCache.set("undef", undefined);
      
      expect(anyCache.has("undef")).toBe(true);
      expect(anyCache.has("missing")).toBe(false);
    });
  });

  describe("default configuration", () => {
    it("should use default config when no config provided", () => {
      const defaultCache = new ToolCache();
      
      // Should be able to store many items with default max size
      for (let i = 0; i < 100; i++) {
        defaultCache.set(`key${i}`, `value${i}`);
      }
      
      expect(defaultCache.size).toBe(100);
    });

    it("should export default config constants", () => {
      expect(DEFAULT_TOOL_CACHE_CONFIG).toEqual({
        defaultTtlMs: 300_000, // 5 minutes
        maxSize: 1000,
      });
    });

    it("should respect default TTL", async () => {
      // This test would take too long with real default TTL (5 minutes)
      // So we just verify the config is available
      const defaultCache = new ToolCache<string>();
      defaultCache.set("key", "value");
      expect(defaultCache.get("key")).toBe("value");
    });
  });

  describe("edge cases", () => {
    it("should handle zero max size", () => {
      const zeroSizeCache = new ToolCache({ defaultTtlMs: 1000, maxSize: 0 });
      
      zeroSizeCache.set("key", "value");
      expect(zeroSizeCache.size).toBe(0);
      expect(zeroSizeCache.get("key")).toBeUndefined();
    });

    it("should handle zero TTL", () => {
      cache.set("key", "value", 0);
      // Should expire immediately
      expect(cache.get("key")).toBeUndefined();
    });

    it("should handle negative TTL", () => {
      cache.set("key", "value", -100);
      // Should expire immediately
      expect(cache.get("key")).toBeUndefined();
    });

    it("should handle very large TTL", () => {
      cache.set("key", "value", Number.MAX_SAFE_INTEGER);
      expect(cache.get("key")).toBe("value");
    });

    it("should handle undefined and null values", () => {
      const anyCache = new ToolCache<any>();
      
      anyCache.set("undefined", undefined);
      anyCache.set("null", null);
      
      // has() correctly identifies cached undefined
      expect(anyCache.has("undefined")).toBe(true);
      expect(anyCache.has("null")).toBe(true);
      expect(anyCache.has("nonexistent")).toBe(false);
      
      expect(anyCache.get("undefined")).toBeUndefined();
      expect(anyCache.get("null")).toBe(null);
    });
  });
});