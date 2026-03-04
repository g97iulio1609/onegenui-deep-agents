import { useMemo } from "react";
import type { ChatMessage } from "../types/index.js";

/**
 * Estimated token counts for a set of messages.
 *
 * Uses a heuristic (~4 chars per token) which is accurate enough
 * for UI display purposes. For exact counts, use the model's tokenizer.
 */
export interface TokenEstimate {
  /** Total estimated tokens across all messages. */
  total: number;
  /** Estimated tokens per role. */
  byRole: Record<string, number>;
  /** Whether the total exceeds the given limit (if provided). */
  isOverLimit: boolean;
  /** Percentage of limit used (0-100+). NaN if no limit provided. */
  percentUsed: number;
}

/** Average characters per token for GPT-family models. */
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Estimate token usage for a set of messages.
 *
 * @param messages - The chat messages to count.
 * @param limit - Optional token limit (e.g., 4096, 128000).
 * @returns Memoized token estimates.
 *
 * @example
 * ```tsx
 * const { total, isOverLimit, percentUsed } = useTokenCount(messages, 4096);
 * ```
 */
export function useTokenCount(
  messages: ChatMessage[],
  limit?: number,
): TokenEstimate {
  return useMemo(() => {
    const byRole: Record<string, number> = {};
    let total = 0;

    for (const msg of messages) {
      const text = getMessageText(msg);
      const tokens = estimateTokens(text);
      total += tokens;
      byRole[msg.role] = (byRole[msg.role] ?? 0) + tokens;
    }

    const isOverLimit = limit != null ? total > limit : false;
    const percentUsed = limit != null ? (total / limit) * 100 : NaN;

    return { total, byRole, isOverLimit, percentUsed };
  }, [messages, limit]);
}
