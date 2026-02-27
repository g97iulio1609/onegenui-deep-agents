// =============================================================================
// Plugin Loader — Dynamically loads installed marketplace plugins
// =============================================================================

import type { MarketplacePluginManifest, MarketplacePort } from "../../ports/plugin-manifest.port.js";
import type { DeepAgentPlugin } from "../../ports/plugin.port.js";
import { getPluginDir } from "./local-cache.js";
import { join, resolve, sep } from "node:path";

export interface LoadedPlugin {
  manifest: MarketplacePluginManifest;
  plugin: DeepAgentPlugin;
}

export interface PluginLoaderOptions {
  /** Validate plugin exports before loading. Default: true */
  validate?: boolean;
}

/**
 * Loads marketplace plugins from disk into executable DeepAgentPlugin instances.
 * Plugins must export a default DeepAgentPlugin or `{ plugin: DeepAgentPlugin }`.
 */
export class PluginLoader {
  private readonly validate: boolean;

  constructor(options?: PluginLoaderOptions) {
    this.validate = options?.validate ?? true;
  }

  /**
   * Load a single installed plugin by name.
   * Resolves the entry path from manifest and dynamically imports.
   */
  async load(manifest: MarketplacePluginManifest): Promise<LoadedPlugin> {
    const dir = getPluginDir(manifest.name);
    const entryPath = resolve(join(dir, manifest.entry));

    // Prevent path traversal — entry must stay within plugin directory
    if (!entryPath.startsWith(dir + sep) && entryPath !== dir) {
      throw new Error(
        `Invalid entry path: "${manifest.entry}" escapes plugin directory for "${manifest.name}"`,
      );
    }

    let mod: Record<string, unknown>;
    try {
      mod = (await import(entryPath)) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Failed to load plugin "${manifest.name}" from ${entryPath}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const plugin = this.extractPlugin(mod, manifest.name);
    if (this.validate) {
      this.validatePlugin(plugin, manifest.name);
    }

    return { manifest, plugin };
  }

  /**
   * Load all installed plugins from a marketplace.
   * Skips plugins that fail to load (logs warning).
   */
  async loadAll(marketplace: MarketplacePort): Promise<LoadedPlugin[]> {
    const installed = await marketplace.listInstalled();
    const loaded: LoadedPlugin[] = [];

    for (const manifest of installed) {
      try {
        const result = await this.load(manifest);
        loaded.push(result);
      } catch {
        // Skip failed plugins — callers can listInstalled() to see all
      }
    }

    return loaded;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private extractPlugin(mod: Record<string, unknown>, name: string): DeepAgentPlugin {
    // Try: default export
    if (mod.default && typeof mod.default === "object" && "name" in (mod.default as object)) {
      return mod.default as DeepAgentPlugin;
    }
    // Try: named export `plugin`
    if (mod.plugin && typeof mod.plugin === "object" && "name" in (mod.plugin as object)) {
      return mod.plugin as DeepAgentPlugin;
    }
    throw new Error(
      `Plugin "${name}" must export a default DeepAgentPlugin or a named "plugin" export.`,
    );
  }

  private validatePlugin(plugin: DeepAgentPlugin, name: string): void {
    if (!plugin.name || typeof plugin.name !== "string") {
      throw new Error(`Plugin "${name}" is missing a valid "name" property.`);
    }
  }
}
