import { describe, expect, it } from "vitest";
import { throttleMiddleware } from "../transport/throttle-middleware.js";
import type { StreamEvent, ChatMessage, TransportOptions } from "../types/index.js";

type SendFn = (
  messages: ChatMessage[],
  options: TransportOptions & { signal: AbortSignal },
) => AsyncIterable<StreamEvent>;

function makeSendFn(events: StreamEvent[]): SendFn {
  return async function* send() {
    for (const event of events) {
      yield event;
    }
  };
}

describe("throttleMiddleware", () => {
  const emptyArgs: [ChatMessage[], TransportOptions & { signal: AbortSignal }] = [
    [] as ChatMessage[],
    {} as TransportOptions & { signal: AbortSignal },
  ];

  it("should forward all text when interval is 0", async () => {
    const events: StreamEvent[] = [
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " World" },
      { type: "finish", finishReason: "stop" },
    ];
    const middleware = throttleMiddleware({ intervalMs: 0 });
    const wrapped = middleware(makeSendFn(events));

    const results: StreamEvent[] = [];
    for await (const event of wrapped(...emptyArgs)) {
      results.push(event);
    }

    const textParts = results
      .filter((e): e is { type: "text-delta"; text: string } => e.type === "text-delta")
      .map((e) => e.text);
    expect(textParts.join("")).toBe("Hello World");
    expect(results[results.length - 1]).toEqual({ type: "finish", finishReason: "stop" });
  });

  it("should flush buffered text before non-text events", async () => {
    const events: StreamEvent[] = [
      { type: "text-delta", text: "Pre-tool " },
      { type: "tool-call", toolName: "search", toolCallId: "tc1", args: {} },
      { type: "text-delta", text: "Post-tool" },
      { type: "finish", finishReason: "stop" },
    ];
    const middleware = throttleMiddleware({ intervalMs: 10000 });
    const wrapped = middleware(makeSendFn(events));

    const results: StreamEvent[] = [];
    for await (const event of wrapped(...emptyArgs)) {
      results.push(event);
    }

    const textBeforeTool = results.findIndex((e) => e.type === "tool-call");
    expect(textBeforeTool).toBeGreaterThan(0);
    expect(results[textBeforeTool - 1]).toEqual({ type: "text-delta", text: "Pre-tool " });
  });

  it("should flush remaining buffer at end of stream", async () => {
    const events: StreamEvent[] = [
      { type: "text-delta", text: "A" },
      { type: "text-delta", text: "B" },
    ];
    const middleware = throttleMiddleware({ intervalMs: 10000 });
    const wrapped = middleware(makeSendFn(events));

    const results: StreamEvent[] = [];
    for await (const event of wrapped(...emptyArgs)) {
      results.push(event);
    }

    // All text should be present (possibly in 1 or 2 events depending on timing)
    const allText = results
      .filter((e): e is { type: "text-delta"; text: string } => e.type === "text-delta")
      .map((e) => e.text)
      .join("");
    expect(allText).toBe("AB");
  });

  it("should use default 16ms interval when no options provided", async () => {
    const events: StreamEvent[] = [
      { type: "text-delta", text: "Hello" },
      { type: "finish", finishReason: "stop" },
    ];
    const middleware = throttleMiddleware();
    const wrapped = middleware(makeSendFn(events));

    const results: StreamEvent[] = [];
    for await (const event of wrapped(...emptyArgs)) {
      results.push(event);
    }

    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
