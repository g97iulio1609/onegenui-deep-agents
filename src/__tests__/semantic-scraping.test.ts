import { describe, it, expect, beforeEach } from "vitest";
import { SemanticScrapingAdapter, urlToPattern, hashTools } from "../adapters/semantic-scraping/index.js";
import type { SemanticTool } from "../ports/semantic-scraping.port.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTool(name: string, overrides: Partial<SemanticTool> = {}): SemanticTool {
  return {
    name,
    description: `Tool: ${name}`,
    inputSchema: { type: "object", properties: {} },
    confidence: 0.8,
    category: "test",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// urlToPattern
// ─────────────────────────────────────────────────────────────────────────────

describe("urlToPattern", () => {
  it("strips query values and sorts keys", () => {
    expect(urlToPattern("https://example.com/page?b=2&a=1")).toBe(
      "/page?a=*&b=*",
    );
  });

  it("returns path for URLs without query", () => {
    expect(urlToPattern("https://example.com/about")).toBe("/about");
  });

  it("normalizes trailing slashes", () => {
    expect(urlToPattern("https://example.com/about/")).toBe("/about");
  });

  it("returns / for root URL", () => {
    expect(urlToPattern("https://example.com")).toBe("/");
  });

  it("returns input for invalid URLs", () => {
    expect(urlToPattern("not-a-url")).toBe("not-a-url");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hashTools
// ─────────────────────────────────────────────────────────────────────────────

describe("hashTools", () => {
  it("produces consistent hashes for same input", () => {
    const tools = [makeTool("a"), makeTool("b")];
    const h1 = hashTools(tools);
    const h2 = hashTools(tools);
    expect(h1).toBe(h2);
  });

  it("is order-independent", () => {
    const h1 = hashTools([makeTool("a"), makeTool("b")]);
    const h2 = hashTools([makeTool("b"), makeTool("a")]);
    expect(h1).toBe(h2);
  });

  it("differs for different tool sets", () => {
    const h1 = hashTools([makeTool("a")]);
    const h2 = hashTools([makeTool("b")]);
    expect(h1).not.toBe(h2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticScrapingAdapter
// ─────────────────────────────────────────────────────────────────────────────

describe("SemanticScrapingAdapter", () => {
  let adapter: SemanticScrapingAdapter;
  const origin = "https://example.com";

  beforeEach(() => {
    adapter = new SemanticScrapingAdapter();
  });

  // ── Manifest creation ──

  it("returns null for unknown origin", () => {
    expect(adapter.getManifest(origin)).toBeNull();
  });

  it("creates a manifest on first updatePage", () => {
    const manifest = adapter.updatePage(origin, `${origin}/page`, [
      makeTool("search"),
    ]);
    expect(manifest.origin).toBe(origin);
    expect(manifest.version).toBe(1);
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0].name).toBe("search");
  });

  // ── Incremental updates ──

  it("increments version on each update", () => {
    adapter.updatePage(origin, `${origin}/a`, [makeTool("t1")]);
    const m2 = adapter.updatePage(origin, `${origin}/b`, [makeTool("t2")]);
    expect(m2.version).toBe(2);
  });

  it("replaces tools for same page pattern", () => {
    adapter.updatePage(origin, `${origin}/page`, [makeTool("old")]);
    const m = adapter.updatePage(origin, `${origin}/page`, [makeTool("new")]);
    expect(m.tools.map((t) => t.name)).toEqual(["new"]);
  });

  // ── Cross-page deduplication ──

  it("deduplicates tools across pages", () => {
    adapter.updatePage(origin, `${origin}/a`, [makeTool("shared")]);
    const m = adapter.updatePage(origin, `${origin}/b`, [makeTool("shared")]);
    expect(m.tools).toHaveLength(1);
    expect(m.tools[0].pagePatterns).toEqual(["/a", "/b"]);
  });

  // ── URL pattern grouping ──

  it("groups URLs with different query values into same pattern", () => {
    adapter.updatePage(origin, `${origin}/watch?v=abc`, [makeTool("player")]);
    const m = adapter.updatePage(origin, `${origin}/watch?v=xyz`, [
      makeTool("player"),
    ]);
    expect(Object.keys(m.pages)).toEqual(["/watch?v=*"]);
    expect(m.tools).toHaveLength(1);
  });

  // ── Diff-based updates ──

  it("applies diff — adds and removes tools", () => {
    adapter.updatePage(origin, `${origin}/page`, [
      makeTool("keep"),
      makeTool("remove"),
    ]);
    const m = adapter.applyDiff(
      origin,
      `${origin}/page`,
      [makeTool("added")],
      ["remove"],
    );
    const names = m.tools.map((t) => t.name).sort();
    expect(names).toEqual(["added", "keep"]);
  });

  it("applyDiff on empty manifest creates tools", () => {
    const m = adapter.applyDiff(origin, `${origin}/page`, [makeTool("new")], []);
    expect(m.tools).toHaveLength(1);
    expect(m.tools[0].name).toBe("new");
  });

  // ── MCP JSON export ──

  it("exports empty tools for unknown origin", () => {
    const json = adapter.toMCPJson(origin);
    expect(JSON.parse(json)).toEqual({ tools: [] });
  });

  it("exports valid MCP JSON with _meta", () => {
    adapter.updatePage(origin, `${origin}/page`, [makeTool("t1")]);
    const json = adapter.toMCPJson(origin);
    const parsed = JSON.parse(json);
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0].name).toBe("t1");
    expect(parsed._meta.origin).toBe(origin);
    expect(parsed._meta.toolCount).toBe(1);
    expect(parsed._meta.pageCount).toBe(1);
  });

  it("excludes annotations from MCP JSON when absent", () => {
    adapter.updatePage(origin, `${origin}/page`, [makeTool("t1")]);
    const parsed = JSON.parse(adapter.toMCPJson(origin));
    expect(parsed.tools[0]).not.toHaveProperty("annotations");
  });

  it("includes annotations in MCP JSON when present", () => {
    adapter.updatePage(origin, `${origin}/page`, [
      makeTool("t1", { annotations: { readOnlyHint: true } }),
    ]);
    const parsed = JSON.parse(adapter.toMCPJson(origin));
    expect(parsed.tools[0].annotations).toEqual({ readOnlyHint: true });
  });

  // ── getToolsForUrl ──

  it("returns empty array for unknown URL", () => {
    expect(adapter.getToolsForUrl(origin, `${origin}/unknown`)).toEqual([]);
  });

  it("returns tools matching the URL pattern", () => {
    adapter.updatePage(origin, `${origin}/page`, [
      makeTool("t1"),
      makeTool("t2"),
    ]);
    const tools = adapter.getToolsForUrl(origin, `${origin}/page`);
    expect(tools.map((t) => t.name).sort()).toEqual(["t1", "t2"]);
  });

  // ── Malformed input handling ──

  it("handles stringified inputSchema", () => {
    const m = adapter.updatePage(origin, `${origin}/page`, [
      makeTool("t1", {
        inputSchema: JSON.stringify({ type: "object", properties: { q: { type: "string" } } }),
      }),
    ]);
    expect(m.tools[0].inputSchema).toEqual({
      type: "object",
      properties: { q: { type: "string" } },
    });
  });

  it("handles invalid JSON in stringified inputSchema", () => {
    const m = adapter.updatePage(origin, `${origin}/page`, [
      makeTool("t1", { inputSchema: "{broken" }),
    ]);
    expect(m.tools[0].inputSchema).toEqual({ type: "object", properties: {} });
  });

  // ── Removal cleanup ──

  it("removes tools when replaced on all pages", () => {
    adapter.updatePage(origin, `${origin}/a`, [makeTool("shared")]);
    adapter.updatePage(origin, `${origin}/b`, [makeTool("shared")]);
    // Replace shared on page /a with something else
    adapter.updatePage(origin, `${origin}/a`, [makeTool("other")]);
    // shared still on /b
    let m = adapter.getManifest(origin)!;
    expect(m.tools.find((t) => t.name === "shared")).toBeDefined();
    // Now remove from /b too
    adapter.updatePage(origin, `${origin}/b`, [makeTool("another")]);
    m = adapter.getManifest(origin)!;
    expect(m.tools.find((t) => t.name === "shared")).toBeUndefined();
  });
});
