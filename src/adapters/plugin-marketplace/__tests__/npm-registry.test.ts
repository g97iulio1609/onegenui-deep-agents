import { describe, it, expect, vi, beforeEach } from "vitest";

import { NpmRegistryAdapter } from "../npm-registry.adapter.js";
import * as localCache from "../local-cache.js";

// ─── Mock local-cache ────────────────────────────────────────────────────────

vi.mock("../local-cache.js", () => ({
  saveManifest: vi.fn(),
  readInstalledManifests: vi.fn(() => []),
  removePluginDir: vi.fn(),
  getPluginDir: vi.fn((name: string) => `/home/user/.gaussflow/plugins/${name}`),
}));

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal("fetch", mockFetch);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NPM_SEARCH_RESPONSE = {
  objects: [
    {
      package: {
        name: "@gaussflow/plugin-web-search",
        version: "1.2.0",
        description: "Web search plugin for Gauss",
        author: { name: "alice" },
        keywords: ["gaussflow-plugin", "search"],
      },
    },
    {
      package: {
        name: "gaussflow-plugin-calc",
        version: "0.5.0",
        description: "Calculator plugin",
        author: "bob",
        keywords: ["gaussflow-plugin", "math"],
      },
    },
  ],
};

const NPM_PACKAGE_RESPONSE = {
  name: "@gaussflow/plugin-web-search",
  version: "1.2.0",
  description: "Web search plugin for Gauss",
  author: { name: "alice" },
  keywords: ["gaussflow-plugin", "search"],
  main: "./dist/index.js",
  gaussflow: {
    entry: "./dist/plugin.js",
    tags: ["search", "web"],
  },
};

function mockJsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    json: () => Promise.resolve(data),
  } as Response;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NpmRegistryAdapter", () => {
  let adapter: NpmRegistryAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NpmRegistryAdapter({ keyword: "gaussflow-plugin" });
  });

  describe("search()", () => {
    it("returns manifests from npm search results", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(NPM_SEARCH_RESPONSE));

      const results = await adapter.search("search");
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("@gaussflow/plugin-web-search");
      expect(results[0].author).toBe("alice");
      expect(results[0].source).toBe("npm");
      expect(results[1].author).toBe("bob");
    });

    it("builds search URL with keyword", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ objects: [] }));
      await adapter.search("test");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("keywords%3Agaussflow-plugin"),
      );
    });

    it("builds search URL with scope when configured", async () => {
      adapter = new NpmRegistryAdapter({ scope: "@gaussflow" });
      mockFetch.mockResolvedValue(mockJsonResponse({ objects: [] }));
      await adapter.search("test");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("scope%3A%40gaussflow"),
      );
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));
      await expect(adapter.search("test")).rejects.toThrow("Failed to fetch npm registry");
    });

    it("handles non-OK responses", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(null, false, 503));
      await expect(adapter.search("test")).rejects.toThrow("npm registry returned HTTP 503");
    });
  });

  describe("getManifest()", () => {
    it("returns manifest for existing package", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(NPM_PACKAGE_RESPONSE));

      const manifest = await adapter.getManifest("@gaussflow/plugin-web-search");
      expect(manifest).not.toBeNull();
      expect(manifest!.name).toBe("@gaussflow/plugin-web-search");
      expect(manifest!.entry).toBe("./dist/plugin.js"); // from gaussflow config
      expect(manifest!.tags).toEqual(["search", "web"]);
    });

    it("returns null for non-existent package", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(null, false, 404));
      const manifest = await adapter.getManifest("nonexistent");
      expect(manifest).toBeNull();
    });

    it("uses main field as entry fallback when no gaussflow config", async () => {
      const pkg = { ...NPM_PACKAGE_RESPONSE, gaussflow: undefined, main: "./lib/main.js" };
      mockFetch.mockResolvedValue(mockJsonResponse(pkg));

      const manifest = await adapter.getManifest("pkg");
      expect(manifest!.entry).toBe("./lib/main.js");
    });
  });

  describe("install()", () => {
    it("saves manifest locally", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(NPM_PACKAGE_RESPONSE));
      await adapter.install("@gaussflow/plugin-web-search");
      expect(localCache.saveManifest).toHaveBeenCalled();
    });

    it("throws for unknown package", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(null, false, 404));
      await expect(adapter.install("nonexistent")).rejects.toThrow('not found on npm');
    });
  });

  describe("uninstall()", () => {
    it("removes plugin directory", async () => {
      await adapter.uninstall("some-plugin");
      expect(localCache.removePluginDir).toHaveBeenCalledWith("some-plugin");
    });
  });

  describe("listInstalled()", () => {
    it("delegates to local cache", async () => {
      await adapter.listInstalled();
      expect(localCache.readInstalledManifests).toHaveBeenCalled();
    });
  });
});
