import type { ChatTransport } from "../types/index.js";
import type { TransportMiddleware } from "./middleware.js";

export interface RateLimitOptions {
  /** Max requests per window (default: 60). */
  maxRequests?: number;
  /** Window size in ms (default: 60000 = 1 minute). */
  windowMs?: number;
  /** Called when rate limited. */
  onRateLimited?: (retryAfterMs: number) => void;
}

export class RateLimitError extends Error {
  public readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Rate limited — retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function rateLimitMiddleware(
  options?: RateLimitOptions,
): TransportMiddleware {
  const maxRequests = options?.maxRequests ?? 60;
  const windowMs = options?.windowMs ?? 60_000;
  const onRateLimited = options?.onRateLimited;

  const timestamps: number[] = [];

  return (next: ChatTransport["send"]): ChatTransport["send"] =>
    async function* rateLimitSend(messages, opts) {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Evict entries outside the window
      while (timestamps.length > 0 && timestamps[0] <= windowStart) {
        timestamps.shift();
      }

      if (timestamps.length >= maxRequests) {
        const retryAfterMs = timestamps[0] + windowMs - now;
        onRateLimited?.(retryAfterMs);
        throw new RateLimitError(retryAfterMs);
      }

      timestamps.push(now);
      yield* next(messages, opts);
    };
}
