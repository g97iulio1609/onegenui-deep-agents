import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChat } from "../hooks/use-chat.js";
import type { ChatTransport, StreamEvent } from "../types/index.js";

function createMockTransport(events: StreamEvent[]): ChatTransport {
  return {
    async *send() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

describe("useChat", () => {
  it("should initialize with default state", () => {
    const { result } = renderHook(() =>
      useChat({ transport: createMockTransport([]) }),
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("should accept initial messages", () => {
    const initialMessages = [
      {
        id: "1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Hello" }],
      },
    ];

    const { result } = renderHook(() =>
      useChat({
        transport: createMockTransport([]),
        initialMessages,
      }),
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("should send a message and receive streaming response", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " there!" },
      { type: "finish", finishReason: "stop" },
    ]);

    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useChat({ transport, onFinish }),
    );

    await act(async () => {
      await result.current.sendMessage("Hi!");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.status).toBe("idle");
    expect(onFinish).toHaveBeenCalled();
  });

  it("should handle string input for sendMessage", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Response" },
    ]);

    const { result } = renderHook(() => useChat({ transport }));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.messages[0].parts[0]).toEqual({
      type: "text",
      text: "Hello",
    });
  });

  it("should handle SendMessageOptions input", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "OK" },
    ]);

    const { result } = renderHook(() => useChat({ transport }));

    await act(async () => {
      await result.current.sendMessage({
        text: "Hello",
        data: { custom: true },
      });
    });

    expect(result.current.messages[0].parts[0]).toEqual({
      type: "text",
      text: "Hello",
    });
  });

  it("should handle stream errors", async () => {
    const transport: ChatTransport = {
      async *send() {
        yield { type: "error" as const, error: "Server error" };
      },
    };

    const onError = vi.fn();
    const { result } = renderHook(() => useChat({ transport, onError }));

    await act(async () => {
      await result.current.sendMessage("Hi!");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalled();
  });

  it("should handle tool call events", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Searching..." },
      {
        type: "tool-call",
        toolName: "search",
        toolCallId: "tc1",
        args: { q: "test" },
      },
      {
        type: "tool-result",
        toolCallId: "tc1",
        result: { data: "found" },
      },
      { type: "text-delta", text: " Done!" },
    ]);

    const { result } = renderHook(() => useChat({ transport }));

    await act(async () => {
      await result.current.sendMessage("Search for test");
    });

    expect(result.current.messages).toHaveLength(2);
    // Assistant message should have tool-related parts
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.role).toBe("assistant");
  });

  it("should reset messages and state", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Hello" },
    ]);

    const { result } = renderHook(() => useChat({ transport }));

    await act(async () => {
      await result.current.sendMessage("Hi!");
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("should stop streaming on abort", async () => {
    const transport: ChatTransport = {
      async *send(_msgs, opts) {
        yield { type: "text-delta" as const, text: "Start" };
        // Simulate a long wait that gets aborted
        await new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      },
    };

    const { result } = renderHook(() => useChat({ transport }));

    const sendPromise = act(async () => {
      const p = result.current.sendMessage("Hi!");
      // Let the stream start
      await new Promise((r) => setTimeout(r, 10));
      result.current.stop();
      await p;
    });

    await sendPromise;
    expect(result.current.status).toBe("idle");
  });
});
