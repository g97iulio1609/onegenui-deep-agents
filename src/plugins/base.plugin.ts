// =============================================================================
// BasePlugin — Abstract base class for Agent plugins
// =============================================================================

import type { Plugin, PluginHooks } from "../ports/plugin.port.js";

export abstract class BasePlugin implements Plugin {
  abstract readonly name: string;
  readonly version = "1.0.0";
  readonly hooks: PluginHooks;

  constructor() {
    this.hooks = this.buildHooks();
  }

  protected abstract buildHooks(): PluginHooks;
}
