import { describe, it, expect, vi, beforeEach } from "vitest";

import { CompositeMarketplaceAdapter } from "../composite-marketplace.adapter.js";
import type { MarketplacePluginManifest, MarketplacePort } from "../../../ports/plugin-manifest.port.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRegistry(
  plugins: MarketplacePluginManifest[],
  overrides?: Partial<MarketplacePort>,
): MarketplacePort {
  return {
    search: vi.fn(async (query: string) =>
      plugins.filter((p) => p.name.includes(query) || p.description.includes(query)),
    ),
    getManifest: vi.fn(async (name: string) =>
      plugins.find((p) => p.name === name) ?? null,
    ),
    listInstalled: vi.fn(async () => []),
    install: vi.fn(async () => {}),
    uninstall: vi.fn(async () => {}),
    ...overrides,
  };
}

const GITHUB_PLUGINS: MarketplacePluginManifest[] = [
  { name: "plugin-a", version: "1.0.0", description: "A from GitHub", author: "a", entry: "./index.js", source: "github" },
  { name: "plugin-shared", version: "1.0.0", description: "Shared plugin", author: "s", entry: "./index.js", source: "github" },
];

const NPM_PLUGINS: MarketplacePluginManifest[] = [
  { name: "plugin-b", version: "2.0.0", description: "B from npm", author: "b", entry: "./index.js", source: "npm" },
  { name: "plugin-shared", version: "2.0.0", description: "Shared plugin (npm)", author: "s", entry: "./main.js", source: "npm" },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CompositeMarketplaceAdapter", () => {
  let github: MarketplacePort;
  let npm: MarketplacePort;
  let composite: CompositeMarketplaceAdapter;

  beforeEach(() => {
    github = createMockRegistry(GITHUB_PLUGINS);
    npm = createMockRegistry(NPM_PLUGINS);
    composite = new CompositeMarketplaceAdapter({ registries: [github, npm] });
  });

  it("requires at least one registry", () => {
    expect(() => new CompositeMarketplaceAdapter({ registries: [] })).toThrow(
      "at least one registry",
    );
  });

  describe("search()", () => {
    it("combines results from all registries", async () => {
      const results = await composite.search("plugin");
      // plugin-a, plugin-shared (github wins), plugin-b — dedup removes npm's shared
      expect(results).toHaveLength(3);
      const names = results.map((r) => r.name);
      expect(names).toContain("plugin-a");
      expect(names).toContain("plugin-b");
      expect(names).toContain("plugin-shared");
    });

    it("deduplicates by name (first source wins)", async () => {
      const results = await composite.search("shared");
      const shared = results.find((r) => r.name === "plugin-shared");
      expect(shared?.source).toBe("github"); // github is first registry
    });

    it("returns all duplicates when deduplicate=false", async () => {
      composite = new CompositeMarketplaceAdapter({
        registries: [github, npm],
        deduplicate: false,
      });
      const results = await composite.search("shared");
      const sharedPlugins = results.filter((r) => r.name === "plugin-shared");
      expect(sharedPlugins).toHaveLength(2);
    });

    it("handles registry failures gracefully", async () => {
      const failing = createMockRegistry([], {
        search: vi.fn(async () => { throw new Error("down"); }),
      });
      composite = new CompositeMarketplaceAdapter({ registries: [failing, npm] });
      const results = await composite.search("plugin");
      expect(results.length).toBeGreaterThan(0); // npm still works
    });
  });

  describe("getManifest()", () => {
    it("returns manifest from first matching registry", async () => {
      const manifest = await composite.getManifest("plugin-a");
      expect(manifest?.source).toBe("github");
    });

    it("falls back to next registry", async () => {
      const manifest = await composite.getManifest("plugin-b");
      expect(manifest?.source).toBe("npm");
    });

    it("returns null when not found in any registry", async () => {
      const manifest = await composite.getManifest("nonexistent");
      expect(manifest).toBeNull();
    });

    it("skips failing registries", async () => {
      const failing = createMockRegistry([], {
        getManifest: vi.fn(async () => { throw new Error("down"); }),
      });
      composite = new CompositeMarketplaceAdapter({ registries: [failing, npm] });
      const manifest = await composite.getManifest("plugin-b");
      expect(manifest?.name).toBe("plugin-b");
    });
  });

  describe("install()", () => {
    it("delegates to the registry that has the plugin", async () => {
      await composite.install("plugin-b");
      expect(npm.install).toHaveBeenCalledWith("plugin-b");
      expect(github.install).not.toHaveBeenCalled();
    });

    it("throws when plugin not found in any registry", async () => {
      await expect(composite.install("nonexistent")).rejects.toThrow("not found in any registry");
    });
  });

  describe("uninstall()", () => {
    it("delegates to first registry", async () => {
      await composite.uninstall("plugin-a");
      expect(github.uninstall).toHaveBeenCalledWith("plugin-a");
    });
  });

  describe("listInstalled()", () => {
    it("delegates to first registry", async () => {
      await composite.listInstalled();
      expect(github.listInstalled).toHaveBeenCalled();
    });
  });
});
