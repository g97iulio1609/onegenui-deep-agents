// =============================================================================
// DefaultPluginRegistryAdapter — In-memory plugin registry implementation
// =============================================================================

import type { Plugin } from "../../ports/plugin.port.js";
import type {
  PluginManifest,
  PluginRegistryPort,
} from "../../ports/plugin-registry.port.js";

export class DefaultPluginRegistryAdapter implements PluginRegistryPort {
  private readonly manifests = new Map<string, PluginManifest>();

  register(manifest: PluginManifest): void {
    this.validateManifest(manifest);

    if (this.manifests.has(manifest.name)) {
      throw new Error(
        `Plugin "${manifest.name}" is already registered. Unregister it first to replace.`,
      );
    }

    this.manifests.set(manifest.name, manifest);
  }

  unregister(name: string): void {
    if (!this.manifests.has(name)) {
      throw new Error(`Plugin "${name}" is not registered.`);
    }
    this.manifests.delete(name);
  }

  get(name: string): PluginManifest | undefined {
    return this.manifests.get(name);
  }

  list(): PluginManifest[] {
    return [...this.manifests.values()];
  }

  search(query: string): PluginManifest[] {
    const lower = query.toLowerCase();
    return this.list().filter((m) => {
      if (m.name.toLowerCase().includes(lower)) return true;
      if (m.description.toLowerCase().includes(lower)) return true;
      if (m.tags?.some((t) => t.toLowerCase().includes(lower))) return true;
      return false;
    });
  }

  async resolve(name: string): Promise<Plugin> {
    const manifest = this.manifests.get(name);
    if (!manifest) {
      throw new Error(`Plugin "${name}" is not registered.`);
    }

    this.checkDependencies(manifest);

    const { source } = manifest;

    switch (source.type) {
      case "builtin":
        return source.factory();

      case "module": {
        const mod = await import(source.modulePath);
        const exportName = source.exportName ?? "default";
        const exported = mod[exportName];
        if (!exported) {
          throw new Error(
            `Module "${source.modulePath}" does not export "${exportName}".`,
          );
        }
        // Support both class exports (new) and factory/instance exports
        return typeof exported === "function" && exported.prototype
          ? (new exported() as Plugin)
          : (exported as Plugin);
      }

      case "url":
        throw new Error(
          `Loading plugins from URLs is not supported for security reasons. ` +
            `Download the plugin locally and use { type: "module", modulePath: "..." } instead.`,
        );
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name || typeof manifest.name !== "string") {
      throw new Error("Plugin manifest must have a non-empty 'name' string.");
    }
    if (!manifest.version || typeof manifest.version !== "string") {
      throw new Error("Plugin manifest must have a non-empty 'version' string.");
    }
    if (!manifest.description || typeof manifest.description !== "string") {
      throw new Error(
        "Plugin manifest must have a non-empty 'description' string.",
      );
    }
    if (!manifest.source || typeof manifest.source.type !== "string") {
      throw new Error("Plugin manifest must have a valid 'source' object.");
    }
  }

  private checkDependencies(manifest: PluginManifest): void {
    if (!manifest.dependencies?.length) return;

    const missing = manifest.dependencies.filter(
      (dep) => !this.manifests.has(dep),
    );
    if (missing.length > 0) {
      throw new Error(
        `Plugin "${manifest.name}" has unresolved dependencies: ${missing.join(", ")}. ` +
          `Register them before resolving.`,
      );
    }
  }
}
