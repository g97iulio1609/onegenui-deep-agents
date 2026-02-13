// =============================================================================
// SSE Handler — Server-Sent Events HTTP handler using Web APIs
// =============================================================================

import type { EventBus } from "../agent/event-bus.js";
import { createEventStream } from "./event-stream.js";

export interface SseHandlerOptions {
  eventBus: EventBus;
  /** CORS origin. Default: "*" */
  corsOrigin?: string;
}

/**
 * Returns a Request → Response handler that streams agent events as SSE.
 *
 * Query parameters:
 *   ?mode=full|delta   — encoding mode (default: full)
 *   ?filter=type1,type2 — comma-separated event type filter
 */
export function createSseHandler(
  options: SseHandlerOptions,
): (request: Request) => Response {
  const { eventBus, corsOrigin = "*" } = options;

  return (request: Request): Response => {
    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") as "full" | "delta") ?? "full";
    const filterParam = url.searchParams.get("filter");
    const eventTypes = filterParam
      ? filterParam.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;

    const eventStream = createEventStream(eventBus, { mode, eventTypes });

    // Prepend an `:ok` comment as initial keep-alive
    const keepAlive = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(":ok\n\n");
        controller.close();
      },
    });

    const merged = concatStreams(keepAlive, eventStream);

    const textEncoder = new TextEncoder();
    const body = merged.pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(textEncoder.encode(chunk));
        },
      }),
    );

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": corsOrigin,
      },
    });
  };
}

/** Concatenate two ReadableStreams sequentially. */
function concatStreams<T>(
  first: ReadableStream<T>,
  second: ReadableStream<T>,
): ReadableStream<T> {
  const readerA = first.getReader();
  const readerB = second.getReader();
  let readingFirst = true;

  return new ReadableStream<T>({
    async pull(controller) {
      if (readingFirst) {
        const { value, done } = await readerA.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        readingFirst = false;
      }
      const { value, done } = await readerB.read();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel() {
      readerA.cancel();
      readerB.cancel();
    },
  });
}
