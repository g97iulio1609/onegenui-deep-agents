import type { ChatMessage, ChatTransport, StreamEvent, TransportOptions } from "../types/index.js";
import type { TransportMiddleware } from "./middleware.js";

export interface TransportHooks {
  /** Called before sending request. */
  beforeSend?: (
    messages: ChatMessage[],
    options: TransportOptions & { signal: AbortSignal },
  ) => void | Promise<void>;
  /** Called for each received event. */
  onEvent?: (event: StreamEvent) => void;
  /** Called when stream completes. */
  onComplete?: (stats: { eventCount: number; durationMs: number }) => void;
  /** Called on error. */
  onError?: (error: unknown) => void;
}

export function hooksMiddleware(hooks: TransportHooks): TransportMiddleware {
  return (next: ChatTransport["send"]): ChatTransport["send"] =>
    async function* hooksSend(messages, opts) {
      const start = Date.now();
      let eventCount = 0;

      if (hooks.beforeSend) {
        await hooks.beforeSend(messages, opts);
      }

      try {
        for await (const event of next(messages, opts)) {
          eventCount++;
          hooks.onEvent?.(event);
          yield event;
        }
        hooks.onComplete?.({ eventCount, durationMs: Date.now() - start });
      } catch (error: unknown) {
        hooks.onError?.(error);
        throw error;
      }
    };
}
