import { describe, it, expect } from "vitest";

import { createEventStream } from "../event-stream.js";
import { EventBus } from "../../agent/event-bus.js";

// =============================================================================
// Helpers
// =============================================================================

async function readChunks(
  stream: ReadableStream<string>,
  count: number,
): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value!);
  }
  reader.releaseLock();
  return chunks;
}

// =============================================================================
// Tests
// =============================================================================

describe("createEventStream", () => {
  it("SSE format output", async () => {
    const bus = new EventBus("s1");
    const stream = createEventStream(bus);

    // Emit after a tick so the stream is started
    queueMicrotask(() => bus.emit("agent:start", { prompt: "hi" }));

    const [chunk] = await readChunks(stream, 1);
    expect(chunk).toContain("id: 1");
    expect(chunk).toContain("event: agent:start");
    expect(chunk).toContain("data: ");
    expect(chunk).toMatch(/\n\n$/);
  });

  it("event type filtering", async () => {
    const bus = new EventBus("s1");
    const stream = createEventStream(bus, { eventTypes: ["tool:call"] });

    queueMicrotask(() => {
      bus.emit("agent:start", {}); // should be ignored
      bus.emit("tool:call", { toolName: "test" }); // should be captured
    });

    const chunks = await readChunks(stream, 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("event: tool:call");
  });

  it("stream cancel cleans up subscriptions", async () => {
    const bus = new EventBus("s1");
    const stream = createEventStream(bus);

    // Wildcard listener added by stream
    expect(bus.listenerCount("*")).toBe(1);

    await stream.cancel();

    expect(bus.listenerCount("*")).toBe(0);
  });
});
