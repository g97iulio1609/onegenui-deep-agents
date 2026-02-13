// =============================================================================
// Event Stream — Wraps EventBus into a Web ReadableStream for SSE consumption
// =============================================================================

import type { EventBus } from "../agent/event-bus.js";
import type { AgentEvent } from "../types.js";
import { createDeltaEncoder } from "./delta-encoder.js";

export interface EventStreamOptions {
  /** Filter to specific event types. Default: all ("*"). */
  eventTypes?: string[];
  /** "full" sends every event as-is; "delta" uses delta encoding. */
  mode?: "full" | "delta";
}

/**
 * Creates a ReadableStream of SSE-formatted strings from an EventBus.
 */
export function createEventStream(
  eventBus: EventBus,
  options?: EventStreamOptions,
): ReadableStream<string> {
  const mode = options?.mode ?? "full";
  const eventTypes = options?.eventTypes;
  const encoder = mode === "delta" ? createDeltaEncoder() : null;
  let id = 0;

  const unsubscribes: (() => void)[] = [];

  return new ReadableStream<string>({
    start(controller) {
      const handler = (event: AgentEvent) => {
        let data: string;
        if (encoder) {
          const encoded = encoder.encode(event);
          if (encoded === null) return;
          data = encoded;
        } else {
          data = JSON.stringify(event);
        }

        // Drop events when the internal queue is saturated (backpressure)
        if ((controller.desiredSize ?? 1) <= 0) return;

        id++;
        controller.enqueue(`id: ${id}\nevent: ${event.type}\ndata: ${data}\n\n`);
      };

      if (eventTypes && eventTypes.length > 0) {
        for (const type of eventTypes) {
          unsubscribes.push(eventBus.on(type as any, handler));
        }
      } else {
        unsubscribes.push(eventBus.on("*", handler));
      }
    },

    cancel() {
      for (const unsub of unsubscribes) unsub();
    },
  });
}
