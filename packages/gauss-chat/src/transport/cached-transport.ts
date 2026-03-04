/**
 * In-memory response cache for @gauss-ai/chat.
 *
 * Wraps any ChatTransport and caches responses by a hash of the messages.
 * Useful for deduplicating repeated queries, offline-first UX, or
 * reducing API costs during development.
 *
 * @example
 * ```tsx
 * import { useChat } from "@gauss-ai/chat";
 * import { createCachedTransport } from "@gauss-ai/chat";
 *
 * const transport = createCachedTransport({ ttl: 60_000 });
 *
 * function Chat() {
 *   const chat = useChat({ transport });
 *   // Identical requests within 60s hit the cache.
 * }
 * ```
 */

import type { ChatMessage, ChatTransport, StreamEvent, TransportOptions } from "../types/index.js";

export interface CacheOptions {
  /** Time-to-live in ms. Default: 5 minutes. */
  ttl?: number;
  /** Max cached entries. Default: 100. */
  maxSize?: number;
  /** Custom key generator. Default: JSON.stringify(messages). */
  keyFn?: (messages: ChatMessage[]) => string;
}

interface CacheEntry {
  events: StreamEvent[];
  timestamp: number;
}

/** Create a caching transport that wraps the default fetch-based transport. */
export function createCachedTransport(options: CacheOptions = {}): ChatTransport {
  const { ttl = 5 * 60 * 1000, maxSize = 100, keyFn } = options;
  const cache = new Map<string, CacheEntry>();

  const generateKey = keyFn ?? ((messages: ChatMessage[]) => JSON.stringify(messages));

  function evictExpired() {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.timestamp > ttl) {
        cache.delete(key);
      }
    }
  }

  function evictOldest() {
    while (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
      else break;
    }
  }

  return {
    async *send(
      messages: ChatMessage[],
      opts: TransportOptions & { signal: AbortSignal },
    ): AsyncIterable<StreamEvent> {
      evictExpired();

      const key = generateKey(messages);
      const cached = cache.get(key);

      if (cached && Date.now() - cached.timestamp <= ttl) {
        for (const event of cached.events) {
          yield event;
        }
        return;
      }

      const collectedEvents: StreamEvent[] = [];

      const url = opts.api ?? "/api/chat";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...opts.headers,
        },
        body: JSON.stringify({ messages, ...opts.body }),
        credentials: opts.credentials,
        signal: opts.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload) as StreamEvent;
              collectedEvents.push(event);
              yield event;
            } catch {
              // Skip malformed events
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      evictOldest();
      cache.set(key, { events: collectedEvents, timestamp: Date.now() });
    },
  };
}
