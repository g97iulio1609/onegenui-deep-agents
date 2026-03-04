import type { TransportMiddleware } from "./middleware.js";
import type { ChatMessage, TransportOptions, StreamEvent } from "../types/index.js";

export interface ThrottleOptions {
  /** Minimum interval between forwarded events in milliseconds (default: 16 ≈ 60fps). */
  intervalMs?: number;
}

/**
 * Throttle stream events to reduce UI re-render frequency.
 *
 * Buffers text deltas and only forwards the accumulated text at the
 * configured interval. Non-text events (tool calls, finish, error) are
 * forwarded immediately to preserve correctness.
 *
 * @example
 * ```ts
 * import { applyMiddleware, throttleMiddleware } from "@gauss-ai/chat";
 *
 * const transport = applyMiddleware(baseTransport, [
 *   throttleMiddleware({ intervalMs: 32 }), // ~30fps
 * ]);
 * ```
 */
export function throttleMiddleware(options: ThrottleOptions = {}): TransportMiddleware {
  const intervalMs = options.intervalMs ?? 16;

  return (next) => {
    return async function* send(
      messages: ChatMessage[],
      opts: TransportOptions & { signal: AbortSignal },
    ): AsyncIterable<StreamEvent> {
      let buffer = "";
      let lastFlush = 0;

      for await (const event of next(messages, opts)) {
        if (event.type === "text-delta") {
          buffer += event.text;
          const now = Date.now();

          if (now - lastFlush >= intervalMs) {
            yield { type: "text-delta" as const, text: buffer };
            buffer = "";
            lastFlush = now;
          }
        } else {
          // Flush any buffered text before non-text events
          if (buffer) {
            yield { type: "text-delta" as const, text: buffer };
            buffer = "";
            lastFlush = Date.now();
          }
          yield event;
        }
      }

      // Flush remaining buffer
      if (buffer) {
        yield { type: "text-delta" as const, text: buffer };
      }
    };
  };
}
