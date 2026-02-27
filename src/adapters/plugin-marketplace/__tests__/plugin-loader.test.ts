import { describe, it, expect, vi, beforeEach } from "vitest";

import { PluginLoader } from "../plugin-loader.js";
import type { MarketplacePluginManifest, MarketplacePort } from "../../../ports/plugin-manifest.port.js";

// ─── Mock local-cache (for getPluginDir) ─────────────────────────────────────

vi.mock("../local-cache.js", () => ({
  getPluginDir: vi.fn((name: string) => `/mock/plugins/${name}`),
  saveManifest: vi.fn(),
  readInstalledManifests: vi.fn(() => []),
  removePluginDir: vi.fn(),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_MANIFEST: MarketplacePluginManifest = {
  name: "test-plugin",
  version: "1.0.0",
  description: "Test plugin",
  author: "tester",
  entry: "./index.js",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PluginLoader", () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader();
  });

  describe("load()", () => {
    it("throws when module cannot be imported", async () => {
      await expect(loader.load(VALID_MANIFEST)).rejects.toThrow(
        'Failed to load plugin "test-plugin"',
      );
    });
  });

  describe("loadAll()", () => {
    it("returns empty array when no plugins installed", async () => {
      const marketplace: MarketplacePort = {
        search: vi.fn(async () => []),
        getManifest: vi.fn(async () => null),
        listInstalled: vi.fn(async () => []),
        install: vi.fn(async () => {}),
        uninstall: vi.fn(async () => {}),
      };

      const result = await loader.loadAll(marketplace);
      expect(result).toEqual([]);
      expect(marketplace.listInstalled).toHaveBeenCalled();
    });

    it("skips plugins that fail to load", async () => {
      const marketplace: MarketplacePort = {
        search: vi.fn(async () => []),
        getManifest: vi.fn(async () => null),
        listInstalled: vi.fn(async () => [VALID_MANIFEST]),
        install: vi.fn(async () => {}),
        uninstall: vi.fn(async () => {}),
      };

      // Import will fail since the file doesn't exist
      const result = await loader.loadAll(marketplace);
      expect(result).toEqual([]); // plugin failed to load, skipped
    });
  });

  describe("validation", () => {
    it("respects validate=false option", () => {
      const loaderNoValidate = new PluginLoader({ validate: false });
      expect(loaderNoValidate).toBeInstanceOf(PluginLoader);
    });
  });
});
