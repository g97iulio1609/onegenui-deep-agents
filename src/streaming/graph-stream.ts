// =============================================================================
// Graph Event Stream — Filtered event stream for graph-specific events
// =============================================================================

import type { EventBus } from "../agent/event-bus.js";
import { createEventStream, type EventStreamOptions } from "./event-stream.js";

/** Convenience: creates an event stream filtered to graph-specific events. */
export function createGraphEventStream(
  eventBus: EventBus,
  options?: Omit<EventStreamOptions, "eventTypes">,
): ReadableStream<string> {
  return createEventStream(eventBus, {
    ...options,
    eventTypes: [
      "graph:start", "graph:complete",
      "node:start", "node:complete",
      "fork:start", "fork:complete",
      "consensus:start", "consensus:result",
    ],
  });
}
