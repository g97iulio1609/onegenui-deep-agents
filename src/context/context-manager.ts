// =============================================================================
// ContextManager — Tool result offloading and message truncation
// =============================================================================

import type { Message } from "../types.js";
import type { ContextManagerDeps } from "./types.js";

const TOOL_RESULTS_PATH = "tool-results";

export class ContextManager {
  private readonly deps: ContextManagerDeps;

  constructor(deps: ContextManagerDeps) {
    this.deps = deps;
  }

  shouldOffload(toolResult: string): boolean {
    const tokens = this.deps.tokenCounter.count(toolResult);
    return tokens > this.deps.config.offloadTokenThreshold;
  }

  async offloadToFilesystem(
    toolCallId: string,
    result: string,
  ): Promise<string> {
    const path = `${TOOL_RESULTS_PATH}/${toolCallId}.txt`;
    await this.deps.filesystem.write(path, result, "transient");
    return `[Result saved to transient/${path}]`;
  }

  shouldTruncate(messages: Message[], model: string): boolean {
    const tokenCount = this.deps.tokenCounter.countMessages(messages);
    const windowSize = this.deps.tokenCounter.getContextWindowSize(model);
    return tokenCount > windowSize * this.deps.config.truncationThreshold;
  }

  truncateMessages(messages: Message[], model: string): Message[] {
    if (!messages.length) return [];

    const windowSize = this.deps.tokenCounter.getContextWindowSize(model);
    const budget = Math.floor(
      windowSize * this.deps.config.truncationThreshold,
    );

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const systemTokens = this.deps.tokenCounter.countMessages(systemMessages);
    const remaining = budget - systemTokens;

    if (remaining <= 0) return systemMessages;

    // Keep messages from the end (most recent first)
    const kept: Message[] = [];
    let used = 0;

    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i]!;
      const tokens =
        this.deps.tokenCounter.count(msg.content) + 4;
      if (used + tokens > remaining) break;
      kept.unshift(msg);
      used += tokens;
    }

    return [...systemMessages, ...kept];
  }
}
