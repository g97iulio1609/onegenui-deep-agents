// =============================================================================
// Composite Marketplace Adapter — Combines multiple registry sources
// =============================================================================

import type {
  MarketplacePluginManifest,
  MarketplacePort,
} from "../../ports/plugin-manifest.port.js";

export interface CompositeMarketplaceOptions {
  /** Registries to search, in priority order */
  registries: MarketplacePort[];
  /** Deduplicate by plugin name (first source wins). Default: true */
  deduplicate?: boolean;
}

export class CompositeMarketplaceAdapter implements MarketplacePort {
  private readonly registries: MarketplacePort[];
  private readonly deduplicate: boolean;

  constructor(options: CompositeMarketplaceOptions) {
    if (options.registries.length === 0) {
      throw new Error("CompositeMarketplaceAdapter requires at least one registry");
    }
    this.registries = options.registries;
    this.deduplicate = options.deduplicate ?? true;
  }

  async search(query: string): Promise<MarketplacePluginManifest[]> {
    const results = await Promise.allSettled(
      this.registries.map((r) => r.search(query)),
    );

    const all: MarketplacePluginManifest[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        all.push(...result.value);
      }
    }

    if (!this.deduplicate) return all;

    const seen = new Set<string>();
    return all.filter((m) => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
  }

  async getManifest(name: string): Promise<MarketplacePluginManifest | null> {
    for (const registry of this.registries) {
      try {
        const manifest = await registry.getManifest(name);
        if (manifest) return manifest;
      } catch {
        // try next registry
      }
    }
    return null;
  }

  async listInstalled(): Promise<MarketplacePluginManifest[]> {
    // All registries share the same local cache
    return this.registries[0].listInstalled();
  }

  async install(name: string): Promise<void> {
    const manifest = await this.getManifest(name);
    if (!manifest) {
      throw new Error(`Plugin "${name}" not found in any registry.`);
    }
    // Delegate to the first registry that has the plugin
    for (const registry of this.registries) {
      try {
        const m = await registry.getManifest(name);
        if (m) {
          await registry.install(name);
          return;
        }
      } catch {
        // try next
      }
    }
    throw new Error(`Failed to install "${name}" from any registry.`);
  }

  async uninstall(name: string): Promise<void> {
    await this.registries[0].uninstall(name);
  }
}
