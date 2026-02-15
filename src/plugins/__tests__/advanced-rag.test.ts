// =============================================================================
// Advanced RAG Pipeline Tests — Comprehensive testing for chunking, re-ranking, and hybrid search
// =============================================================================

import { describe, expect, it, vi, beforeEach } from "vitest";
import { VectorlessPlugin } from "../vectorless.plugin.js";
import { DefaultChunkingAdapter } from "../../adapters/chunking/index.js";
import { DefaultReRankingAdapter } from "../../adapters/reranking/index.js";

const mockVectorless = {
  generateKnowledge: vi.fn(),
  queryKnowledge: vi.fn(),
  searchEntities: vi.fn(),
};

const sampleDocument = `
# Introduction to TypeScript

TypeScript is a statically typed programming language developed by Microsoft. It builds on JavaScript by adding static type definitions.

## Key Features

TypeScript offers many benefits:
- Static typing helps catch errors early
- Better IDE support with autocomplete
- Improved code organization
- Compatible with existing JavaScript

## Getting Started

To install TypeScript, run:
npm install -g typescript

Create a new file with .ts extension and start coding!

## Advanced Features

TypeScript supports generics, interfaces, and decorators. These features enable powerful patterns for large-scale applications.

The compiler can detect many common errors at build time, reducing runtime issues.
`;

describe("Advanced RAG Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DefaultChunkingAdapter", () => {
    it("should implement fixed chunking strategy", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk("This is a test document with multiple words that should be chunked properly.", {
        strategy: "fixed",
        maxTokens: 5,
      });

      expect(chunks).toHaveLength(3);
      expect(chunks[0]!.text).toBe("This is a test document");
      expect(chunks[0]!.index).toBe(0);
      expect(chunks[0]!.metadata.tokenCount).toBe(5);
      expect(chunks[0]!.id).toBeDefined();
    });

    it("should implement sliding-window chunking strategy", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk("Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8", {
        strategy: "sliding-window",
        maxTokens: 4,
        overlap: 2,
      });

      expect(chunks).toHaveLength(3);
      expect(chunks[0]!.text).toBe("Word1 Word2 Word3 Word4");
      expect(chunks[1]!.text).toBe("Word3 Word4 Word5 Word6");
      expect(chunks[2]!.text).toBe("Word5 Word6 Word7 Word8");
    });

    it("should implement semantic chunking strategy", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk(
        "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.",
        { strategy: "semantic", maxTokens: 10 }
      );

      expect(chunks).toHaveLength(1); // Should merge small paragraphs
      expect(chunks[0]!.text).toContain("First paragraph");
      expect(chunks[0]!.text).toContain("Second paragraph");
      expect(chunks[0]!.text).toContain("Third paragraph");
    });

    it("should implement recursive chunking strategy", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk(
        "Section 1.\n\nSection 2. This is longer.\n\nSection 3. Even longer section here.",
        {
          strategy: "recursive",
          maxTokens: 6,
          separators: ["\n\n", ". ", " "],
        }
      );

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.metadata.tokenCount).toBeLessThanOrEqual(6);
      }
    });

    it("should handle empty text", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk("", { strategy: "fixed" });
      expect(chunks).toHaveLength(0);
    });

    it("should handle single word", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk("SingleWord", { strategy: "fixed", maxTokens: 5 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.text).toBe("SingleWord");
      expect(chunks[0]!.metadata.tokenCount).toBe(1);
    });

    it("should generate correct metadata", () => {
      const adapter = new DefaultChunkingAdapter();
      const chunks = adapter.chunk("Hello world test", { strategy: "fixed", maxTokens: 2 });
      
      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.metadata.startOffset).toBe(0);
      expect(chunks[0]!.metadata.endOffset).toBe(11); // "Hello world"
      expect(chunks[0]!.metadata.tokenCount).toBe(2);
      expect(chunks[1]!.metadata.tokenCount).toBe(1);
    });
  });

  describe("DefaultReRankingAdapter", () => {
    const sampleResults = [
      { id: "1", text: "TypeScript is a programming language", score: 0 },
      { id: "2", text: "JavaScript and TypeScript comparison", score: 0 },
      { id: "3", text: "Python is also a programming language", score: 0 },
      { id: "4", text: "Programming languages overview", score: 0 },
    ];

    it("should implement TF-IDF re-ranking", () => {
      const adapter = new DefaultReRankingAdapter();
      const reranked = adapter.rerank("TypeScript programming", sampleResults, {
        strategy: "tfidf",
      });

      expect(reranked).toHaveLength(4);
      expect(reranked[0]!.score).toBeGreaterThan(0);
      // Should rank TypeScript-specific documents higher
      expect(reranked[0]!.text).toContain("TypeScript");
    });

    it("should implement BM25 re-ranking", () => {
      const adapter = new DefaultReRankingAdapter();
      const reranked = adapter.rerank("TypeScript programming", sampleResults, {
        strategy: "bm25",
      });

      expect(reranked).toHaveLength(4);
      expect(reranked[0]!.score).toBeGreaterThan(0);
      // BM25 should also favor TypeScript documents
      expect(reranked[0]!.text).toContain("TypeScript");
    });

    it("should implement MMR re-ranking for diversity", () => {
      const adapter = new DefaultReRankingAdapter();
      const reranked = adapter.rerank("programming", sampleResults, {
        strategy: "mmr",
        lambda: 0.5,
      });

      expect(reranked).toHaveLength(4);
      expect(reranked[0]!.score).toBeGreaterThan(reranked[3]!.score);
      // MMR should balance relevance and diversity
    });

    it("should handle empty results", () => {
      const adapter = new DefaultReRankingAdapter();
      const reranked = adapter.rerank("query", [], { strategy: "bm25" });
      expect(reranked).toHaveLength(0);
    });

    it("should default to BM25 for unknown strategy", () => {
      const adapter = new DefaultReRankingAdapter();
      const reranked = adapter.rerank("TypeScript", sampleResults, {
        // @ts-expect-error - testing fallback
        strategy: "unknown",
      });

      expect(reranked).toHaveLength(4);
      expect(reranked[0]!.score).toBeGreaterThan(0);
    });
  });

  describe("VectorlessPlugin RAG Integration", () => {
    it("should have all RAG tools available", () => {
      const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
      const tools = plugin.tools;

      expect(tools).toHaveProperty("rag:ingest");
      expect(tools).toHaveProperty("rag:search");
      expect(tools).toHaveProperty("rag:search-chunks");
    });

    describe("rag:ingest tool", () => {
      it("should chunk document and extract knowledge", async () => {
        mockVectorless.generateKnowledge.mockResolvedValue({
          entities: [{ name: "TypeScript", type: "Language" }],
          relations: [],
          quotes: [],
        });

        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        const result = await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
          source: "typescript-guide",
          chunkingStrategy: "semantic",
          maxTokens: 100,
        });

        expect(result).toContain("Ingested");
        expect(result).toContain("chunks");
        expect(result).toContain("semantic");
        expect(plugin.chunks.size).toBeGreaterThan(0);

        // Verify chunks have source attribution
        const firstChunk = Array.from(plugin.chunks.values())[0];
        expect(firstChunk?.metadata.source).toBe("typescript-guide");
      });

      it("should work without vectorless integration", async () => {
        const plugin = new VectorlessPlugin(); // No vectorless provided
        
        const result = await (plugin.tools["rag:ingest"] as any).execute({
          text: "Simple test document with some content",
          chunkingStrategy: "fixed",
          maxTokens: 3,
        });

        expect(result).toContain("Ingested");
        expect(plugin.chunks.size).toBeGreaterThan(0);
      });

      it("should validate input parameters", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await expect((plugin.tools["rag:ingest"] as any).execute({
          text: "test",
          maxTokens: 0, // Invalid
        })).rejects.toThrow();
      });
    });

    describe("rag:search tool", () => {
      beforeEach(async () => {
        // Set up plugin with chunks and knowledge
        mockVectorless.generateKnowledge.mockResolvedValue({
          entities: [
            { name: "TypeScript", type: "Language" },
            { name: "JavaScript", type: "Language" },
          ],
          relations: [],
          quotes: [],
        });
      });

      it("should perform hybrid search with entity and chunk results", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        // First ingest some content
        await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
          source: "guide",
        });

        const results = await (plugin.tools["rag:search"] as any).execute({
          query: "TypeScript programming",
          limit: 5,
          rerankerStrategy: "bm25",
          includeAttribution: true,
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        
        // Check for proper scoring and attribution
        if (results.length > 0) {
          expect(results[0]).toHaveProperty("score");
          expect(results[0]).toHaveProperty("text");
          // Some results should have source attribution
          const hasAttribution = results.some((r: any) => r.source);
          expect(hasAttribution).toBe(true);
        }
      });

      it("should handle queries with no matches", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: "Content about Python programming",
        });

        const results = await (plugin.tools["rag:search"] as any).execute({
          query: "quantum physics",
          limit: 5,
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      });

      it("should work with different re-ranking strategies", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
        });

        const strategies = ["tfidf", "bm25", "mmr"];
        
        for (const strategy of strategies) {
          const results = await (plugin.tools["rag:search"] as any).execute({
            query: "TypeScript",
            rerankerStrategy: strategy,
          });

          expect(Array.isArray(results)).toBe(true);
          // Each strategy should potentially return different rankings
        }
      });
    });

    describe("rag:search-chunks tool", () => {
      it("should search directly in stored chunks", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
          maxTokens: 50,
        });

        const results = await (plugin.tools["rag:search-chunks"] as any).execute({
          query: "TypeScript features",
          limit: 3,
        });

        expect(Array.isArray(results)).toBe(true);
        if (results.length > 0) {
          expect(results[0]).toHaveProperty("id");
          expect(results[0]).toHaveProperty("text");
          expect(results[0]).toHaveProperty("metadata");
          expect(results[0].text.toLowerCase()).toContain("typescript");
        }
      });

      it("should return empty array for no matches", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: "Content about Python programming",
        });

        const results = await (plugin.tools["rag:search-chunks"] as any).execute({
          query: "quantum mechanics",
        });

        expect(results).toHaveLength(0);
      });

      it("should respect limit parameter", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
          maxTokens: 20, // Create multiple small chunks
        });

        const results = await (plugin.tools["rag:search-chunks"] as any).execute({
          query: "TypeScript",
          limit: 2,
        });

        expect(results.length).toBeLessThanOrEqual(2);
      });

      it("should score results by query match", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: "TypeScript programming. JavaScript also programming. General text here.",
          maxTokens: 3,
        });

        const results = await (plugin.tools["rag:search-chunks"] as any).execute({
          query: "TypeScript programming",
        });

        if (results.length > 1) {
          // Results should be ordered by relevance (matchScore)
          const firstResult = results[0].text.toLowerCase();
          expect(firstResult).toContain("typescript");
          expect(firstResult).toContain("programming");
        }
      });
    });

    describe("Source Attribution", () => {
      it("should provide accurate source attribution in search results", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
          source: "typescript-documentation",
          maxTokens: 50,
        });

        const results = await (plugin.tools["rag:search"] as any).execute({
          query: "TypeScript",
          includeAttribution: true,
        });

        const resultsWithAttribution = results.filter((r: any) => r.source);
        expect(resultsWithAttribution.length).toBeGreaterThan(0);

        const attribution = resultsWithAttribution[0].source;
        expect(attribution).toHaveProperty("chunkId");
        expect(attribution).toHaveProperty("chunkIndex");
        expect(attribution).toHaveProperty("documentId");
        expect(attribution).toHaveProperty("startOffset");
        expect(attribution).toHaveProperty("endOffset");
        expect(attribution).toHaveProperty("relevanceScore");
        expect(attribution.documentId).toBe("typescript-documentation");
      });

      it("should update relevance scores after re-ranking", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: sampleDocument,
          source: "guide",
        });

        const results = await (plugin.tools["rag:search"] as any).execute({
          query: "TypeScript",
          includeAttribution: true,
          rerankerStrategy: "bm25",
        });

        const withAttribution = results.filter((r: any) => r.source);
        if (withAttribution.length > 0) {
          expect(withAttribution[0].source.relevanceScore).toBe(withAttribution[0].score);
        }
      });
    });

    describe("Edge Cases", () => {
      it("should handle very long documents", async () => {
        const longDocument = "Word ".repeat(1000) + "TypeScript programming language.";
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        const result = await (plugin.tools["rag:ingest"] as any).execute({
          text: longDocument,
          maxTokens: 50,
        });

        expect(result).toContain("Ingested");
        expect(plugin.chunks.size).toBeGreaterThan(10);
      });

      it("should handle documents with special characters", async () => {
        const specialDoc = "TypeScript™ is a language © Microsoft. It's 100% compatible with JS!";
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: specialDoc,
          maxTokens: 20,
        });

        const results = await (plugin.tools["rag:search-chunks"] as any).execute({
          query: "TypeScript Microsoft",
        });

        expect(results.length).toBeGreaterThan(0);
      });

      it("should dispose properly and clear chunks", async () => {
        const plugin = new VectorlessPlugin({ vectorless: mockVectorless });
        
        await (plugin.tools["rag:ingest"] as any).execute({
          text: "Test content",
        });

        expect(plugin.chunks.size).toBeGreaterThan(0);
        
        await plugin.dispose();
        
        expect(plugin.chunks.size).toBe(0);
      });
    });
  });
});