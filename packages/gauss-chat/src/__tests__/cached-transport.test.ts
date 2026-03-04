import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCachedTransport, type CacheOptions } from "../transport/cached-transport.js";
import type { ChatMessage, StreamEvent, TransportOptions } from "../types/index.js";

const userMsg: ChatMessage = {
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "Hello" }],
};

function makeSSEBody(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

function mockFetch(events: unknown[]) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      body: makeSSEBody(events),
    }),
  );
}

async function collectEvents(iterable: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

const defaultOpts = { api: "/api/chat", signal: new AbortController().signal } as TransportOptions & { signal: AbortSignal };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createCachedTransport", () => {
  it("should forward events from the network on cache miss", async () => {
    const events = [
      { type: "text-delta", text: "Hi" },
      { type: "finish", finishReason: "stop" },
    ];
    globalThis.fetch = mockFetch(events) as unknown as typeof fetch;

    const transport = createCachedTransport();
    const received = await collectEvents(transport.send([userMsg], defaultOpts));

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ type: "text-delta", text: "Hi" });
    expect(received[1]).toEqual({ type: "finish", finishReason: "stop" });
  });

  it("should return cached events on cache hit", async () => {
    const events = [{ type: "text-delta", text: "cached" }];
    globalThis.fetch = mockFetch(events) as unknown as typeof fetch;

    const transport = createCachedTransport({ ttl: 10_000 });

    const firstReceived = await collectEvents(transport.send([userMsg], defaultOpts));
    const secondReceived = await collectEvents(transport.send([userMsg], defaultOpts));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(secondReceived).toEqual(firstReceived);
  });

  it("should not use cache after TTL expires", async () => {
    const events = [{ type: "text-delta", text: "fresh" }];
    globalThis.fetch = mockFetch(events) as unknown as typeof fetch;

    const transport = createCachedTransport({ ttl: 1 }); // 1ms TTL

    await collectEvents(transport.send([userMsg], defaultOpts));

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 10));

    await collectEvents(transport.send([userMsg], defaultOpts));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("should use different cache keys for different messages", async () => {
    const events = [{ type: "text-delta", text: "response" }];
    globalThis.fetch = mockFetch(events) as unknown as typeof fetch;

    const transport = createCachedTransport();

    const msg2: ChatMessage = { id: "m2", role: "user", parts: [{ type: "text", text: "World" }] };

    await collectEvents(transport.send([userMsg], defaultOpts));
    await collectEvents(transport.send([msg2], defaultOpts));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("should respect maxSize and evict oldest entries", async () => {
    const events = [{ type: "text-delta", text: "ok" }];
    globalThis.fetch = mockFetch(events) as unknown as typeof fetch;

    const transport = createCachedTransport({ maxSize: 2, ttl: 60_000 });

    const msg1: ChatMessage = { id: "1", role: "user", parts: [{ type: "text", text: "A" }] };
    const msg2: ChatMessage = { id: "2", role: "user", parts: [{ type: "text", text: "B" }] };
    const msg3: ChatMessage = { id: "3", role: "user", parts: [{ type: "text", text: "C" }] };

    await collectEvents(transport.send([msg1], defaultOpts));
    await collectEvents(transport.send([msg2], defaultOpts));
    await collectEvents(transport.send([msg3], defaultOpts));

    // msg1 should have been evicted, so it should fetch again
    await collectEvents(transport.send([msg1], defaultOpts));

    // 3 unique first calls + 1 re-fetch for evicted msg1 = 4
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it("should support custom key function", async () => {
    const events = [{ type: "text-delta", text: "ok" }];
    globalThis.fetch = mockFetch(events) as unknown as typeof fetch;

    const transport = createCachedTransport({
      keyFn: (msgs) => msgs.map((m) => m.parts.map((p) => ("text" in p ? p.text : "")).join("")).join("|"),
    });

    const msg1: ChatMessage = { id: "a", role: "user", parts: [{ type: "text", text: "Same" }] };
    const msg2: ChatMessage = { id: "b", role: "user", parts: [{ type: "text", text: "Same" }] };

    await collectEvents(transport.send([msg1], defaultOpts));
    await collectEvents(transport.send([msg2], defaultOpts));

    // Same text → same cache key → only 1 fetch
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
