// =============================================================================
// RollingSummarizer — LLM-based conversation summarization
// =============================================================================

import type { Message, CompressedContext } from "../types.js";
import type { RollingSummarizerDeps } from "./types.js";

const SUMMARIZATION_PROMPT =
  "Summarize the following conversation concisely, preserving key decisions, facts, and context:";

export class RollingSummarizer {
  private readonly deps: RollingSummarizerDeps;

  constructor(deps: RollingSummarizerDeps) {
    this.deps = deps;
  }

  shouldSummarize(messages: Message[], model: string): boolean {
    const tokenCount = this.deps.tokenCounter.countMessages(messages);
    const windowSize = this.deps.tokenCounter.getContextWindowSize(model);
    return tokenCount > windowSize * this.deps.config.summarizationThreshold;
  }

  async summarize(
    messages: Message[],
  ): Promise<{
    summary: CompressedContext;
    remainingMessages: Message[];
  }> {
    const preserveCount = this.deps.config.preserveRecentMessages;

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    if (nonSystem.length <= preserveCount) {
      return {
        summary: {
          summary: "",
          originalMessageCount: 0,
          compressedAt: Date.now(),
        },
        remainingMessages: messages,
      };
    }

    const toSummarize = nonSystem.slice(0, -preserveCount);
    const recent = nonSystem.slice(-preserveCount);

    const conversationText = toSummarize
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const result = await this.deps.model.generate({
      messages: [
        {
          role: "user",
          content: `${SUMMARIZATION_PROMPT}\n\n${conversationText}`,
        },
      ],
    });

    const summary: CompressedContext = {
      summary: result.text,
      originalMessageCount: toSummarize.length,
      compressedAt: Date.now(),
    };

    const summaryMessage: Message = {
      role: "system",
      content: `[Previous conversation summary]\n${result.text}`,
    };

    return {
      summary,
      remainingMessages: [
        ...systemMessages,
        summaryMessage,
        ...recent,
      ],
    };
  }
}
