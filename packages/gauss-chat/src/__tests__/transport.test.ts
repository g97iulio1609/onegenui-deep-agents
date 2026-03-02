import { afterEach, describe, expect, it, vi } from "vitest";
import { GaussTransport } from "../transport/gauss-transport.js";
import type { StreamEvent } from "../types/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockResponse(events: StreamEvent[], ok = true): Response {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => `data: ${JSON.stringify(e)}\n\n`);
  chunks.push("data: [DONE]\n\n");

  let index = 0;
  const readable = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok,
    status: ok ? 200 : 500,
    body: readable,
    text: () => Promise.resolve("Server error"),
    headers: new Headers(),
  } as unknown as Response;
}

describe("GaussTransport", () => {
  it("should send messages and receive text-delta events", async () => {
    const events: StreamEvent[] = [
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " World" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(createMockResponse(events));

    const transport = new GaussTransport();
    const messages = [
      {
        id: "1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Hi" }],
      },
    ];

    const received: StreamEvent[] = [];
    const abortController = new AbortController();

    for await (const event of transport.send(messages, {
      api: "/api/chat",
      signal: abortController.signal,
    })) {
      received.push(event);
    }

    expect(received).toHaveLength(3);
    expect(received[0]).toEqual({ type: "text-delta", text: "Hello" });
    expect(received[1]).toEqual({ type: "text-delta", text: " World" });
    expect(received[2]).toEqual({ type: "finish", finishReason: "stop" });
  });

  it("should handle HTTP errors gracefully", async () => {
    const response = {
      ok: false,
      status: 500,
      body: null,
      text: () => Promise.resolve("Internal Server Error"),
      headers: new Headers(),
    } as unknown as Response;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const transport = new GaussTransport();
    const abortController = new AbortController();

    const received: StreamEvent[] = [];
    for await (const event of transport.send([], {
      api: "/api/chat",
      signal: abortController.signal,
    })) {
      received.push(event);
    }

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("error");
  });

  it("should handle null response body", async () => {
    const response = {
      ok: true,
      status: 200,
      body: null,
      headers: new Headers(),
    } as unknown as Response;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const transport = new GaussTransport();
    const abortController = new AbortController();

    const received: StreamEvent[] = [];
    for await (const event of transport.send([], {
      api: "/api/chat",
      signal: abortController.signal,
    })) {
      received.push(event);
    }

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: "error", error: "Response body is null" });
  });

  it("should handle tool call events", async () => {
    const events: StreamEvent[] = [
      { type: "text-delta", text: "Let me search..." },
      { type: "tool-call", toolName: "web_search", toolCallId: "tc1", args: { query: "test" } },
      { type: "tool-result", toolCallId: "tc1", result: { data: "result" } },
      { type: "text-delta", text: " Found it!" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(createMockResponse(events));

    const transport = new GaussTransport();
    const abortController = new AbortController();

    const received: StreamEvent[] = [];
    for await (const event of transport.send([], {
      api: "/api/chat",
      signal: abortController.signal,
    })) {
      received.push(event);
    }

    expect(received).toHaveLength(5); // 4 events + finish
    expect(received[1]).toEqual({
      type: "tool-call",
      toolName: "web_search",
      toolCallId: "tc1",
      args: { query: "test" },
    });
  });

  it("should merge default options with per-call options", async () => {
    const events: StreamEvent[] = [{ type: "text-delta", text: "ok" }];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(createMockResponse(events));

    const transport = new GaussTransport({
      headers: { "X-Default": "true" },
      body: { model: "gpt-4" },
    });

    const abortController = new AbortController();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _event of transport.send([], {
      api: "/api/chat",
      headers: { "X-Custom": "yes" },
      body: { temperature: 0.5 },
      signal: abortController.signal,
    })) {
      // consume stream
    }

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Default": "true",
          "X-Custom": "yes",
        }),
      }),
    );

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.model).toBe("gpt-4");
    expect(callBody.temperature).toBe(0.5);
  });
});
