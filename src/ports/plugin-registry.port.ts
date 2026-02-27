// =============================================================================
// Plugin Registry Port — Contract for plugin marketplace / registry
// =============================================================================

import type { Plugin } from "./plugin.port.js";

/** Describes how to load/instantiate a plugin */
export type PluginSource =
  | { type: "builtin"; factory: () => Plugin }
  | { type: "module"; modulePath: string; exportName?: string }
  | { type: "url"; url: string };

/** Declarative manifest describing a registerable plugin */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  source: PluginSource;
  dependencies?: string[];
}

/** Port for discovering, registering, and resolving plugins */
export interface PluginRegistryPort {
  /** Register a plugin manifest. Throws if name already registered. */
  register(manifest: PluginManifest): void;
  /** Remove a plugin manifest by name. */
  unregister(name: string): void;
  /** Retrieve a manifest by exact name. */
  get(name: string): PluginManifest | undefined;
  /** List all registered manifests. */
  list(): PluginManifest[];
  /** Search manifests by keyword (matches name, description, tags). */
  search(query: string): PluginManifest[];
  /** Resolve a manifest to a live plugin instance. */
  resolve(name: string): Promise<Plugin>;
}
