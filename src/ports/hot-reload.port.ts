// =============================================================================
// HotReload Port — Contract for watching agent config changes
// =============================================================================

export interface HotReloadPort {
  watch(configPath: string, onChange: (config: HotReloadAgentConfig) => void): void;
  stop(): void;
}

export interface HotReloadAgentConfig {
  name: string;
  model: string;
  systemPrompt?: string;
  maxSteps?: number;
}
