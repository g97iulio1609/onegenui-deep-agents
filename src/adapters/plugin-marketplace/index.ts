export { GitHubRegistryAdapter } from "./github-registry.adapter.js";
export type { GitHubRegistryOptions } from "./github-registry.adapter.js";
export { NpmRegistryAdapter } from "./npm-registry.adapter.js";
export type { NpmRegistryOptions } from "./npm-registry.adapter.js";
export { CompositeMarketplaceAdapter } from "./composite-marketplace.adapter.js";
export type { CompositeMarketplaceOptions } from "./composite-marketplace.adapter.js";
export { PluginLoader } from "./plugin-loader.js";
export type { LoadedPlugin, PluginLoaderOptions } from "./plugin-loader.js";
export {
  getPluginDir,
  saveManifest,
  readInstalledManifests,
  removePluginDir,
} from "./local-cache.js";
