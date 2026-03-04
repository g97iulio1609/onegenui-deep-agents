import type { ChatTransport } from "../types/index.js";
import type { TransportMiddleware } from "./middleware.js";

export interface RetryOptions {
  /** Max retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in ms (default: 1000). */
  baseDelay?: number;
  /** Max delay in ms (default: 30000). */
  maxDelay?: number;
  /** Jitter factor 0-1 (default: 0.2). */
  jitter?: number;
  /** Which HTTP status codes to retry (default: [408, 429, 500, 502, 503, 504]). */
  retryableStatuses?: number[];
  /** Callback when a retry occurs. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRYABLE = [408, 429, 500, 502, 503, 504];

function isRetryable(error: unknown, statuses: number[]): boolean {
  if (error instanceof Error && "status" in error) {
    return statuses.includes((error as Error & { status: number }).status);
  }
  return true;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function retryMiddleware(options?: RetryOptions): TransportMiddleware {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;
  const jitter = options?.jitter ?? 0.2;
  const retryableStatuses = options?.retryableStatuses ?? DEFAULT_RETRYABLE;
  const onRetry = options?.onRetry;

  return (next: ChatTransport["send"]): ChatTransport["send"] =>
    async function* retrySend(messages, opts) {
      let lastError: unknown = new Error("Retry failed — no attempts made");

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          yield* next(messages, opts);
          return;
        } catch (error: unknown) {
          lastError = error;

          if (isAbortError(error) || opts.signal.aborted) throw error;
          if (!isRetryable(error, retryableStatuses)) throw error;
          if (attempt >= maxRetries) throw error;

          const delay = Math.min(
            baseDelay * 2 ** attempt + Math.random() * jitter * baseDelay,
            maxDelay,
          );

          onRetry?.(attempt + 1, error, delay);
          await sleep(delay, opts.signal);
        }
      }

      throw lastError;
    };
}
