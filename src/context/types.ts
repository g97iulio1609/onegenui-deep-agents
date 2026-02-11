// =============================================================================
// Context Module — Additional types
// =============================================================================

import type { TokenCounterPort } from "../ports/token-counter.port.js";
import type { FilesystemPort } from "../ports/filesystem.port.js";
import type { ModelPort } from "../ports/model.port.js";
import type { ContextConfig } from "../types.js";

export interface ContextManagerDeps {
  tokenCounter: TokenCounterPort;
  filesystem: FilesystemPort;
  config: Required<ContextConfig>;
}

export interface RollingSummarizerDeps {
  tokenCounter: TokenCounterPort;
  model: ModelPort;
  config: Required<ContextConfig>;
}

export interface TokenTrackerSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  isOverBudget: boolean;
}
