import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAssistant } from "../hooks/use-assistant.js";
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

describe("useAssistant", () => {
  it("should initialize with default state", () => {
    const { result } = renderHook(() =>
      useAssistant({ transport: createMockTransport([]) }),
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.threadId).toBeUndefined();
  });

  it("should initialize with provided threadId", () => {
    const { result } = renderHook(() =>
      useAssistant({
        transport: createMockTransport([]),
        threadId: "thread_123",
      }),
    );

    expect(result.current.threadId).toBe("thread_123");
  });

  it("should initialize with provided assistantId", () => {
    const { result } = renderHook(() =>
      useAssistant({
        transport: createMockTransport([]),
        assistantId: "asst_abc",
      }),
    );

    expect(result.current.status).toBe("idle");
  });

  it("should send a message and receive streaming response", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " there!" },
      { type: "finish", finishReason: "stop" },
    ]);

    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useAssistant({ transport, onFinish }),
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

    const { result } = renderHook(() => useAssistant({ transport }));

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

    const { result } = renderHook(() => useAssistant({ transport }));

    await act(async () => {
      await result.current.sendMessage({
        text: "Hello",
        data: { fileIds: ["file_1"] },
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
    const { result } = renderHook(() => useAssistant({ transport, onError }));

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

    const { result } = renderHook(() => useAssistant({ transport }));

    await act(async () => {
      await result.current.sendMessage("Search for test");
    });

    expect(result.current.messages).toHaveLength(2);
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.role).toBe("assistant");
  });

  it("should allow setting threadId", () => {
    const { result } = renderHook(() =>
      useAssistant({ transport: createMockTransport([]) }),
    );

    expect(result.current.threadId).toBeUndefined();

    act(() => {
      result.current.setThreadId("thread_new");
    });

    expect(result.current.threadId).toBe("thread_new");
    expect(result.current.messages).toEqual([]);
  });

  it("should clear messages when setThreadId is called", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Hello" },
    ]);

    const { result } = renderHook(() => useAssistant({ transport }));

    await act(async () => {
      await result.current.sendMessage("Hi!");
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.setThreadId("thread_456");
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.threadId).toBe("thread_456");
    expect(result.current.status).toBe("idle");
  });

  it("should cancel a running request", async () => {
    const transport: ChatTransport = {
      async *send(_msgs, opts) {
        yield { type: "text-delta" as const, text: "Start" };
        await new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      },
    };

    const { result } = renderHook(() => useAssistant({ transport }));

    const sendPromise = act(async () => {
      const p = result.current.sendMessage("Hi!");
      await new Promise((r) => setTimeout(r, 10));
      result.current.cancel();
      await p;
    });

    await sendPromise;
    expect(result.current.status).toBe("idle");
  });

  it("should report isRunning correctly", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Hello" },
    ]);

    const { result } = renderHook(() => useAssistant({ transport }));

    expect(result.current.isRunning).toBe(false);

    await act(async () => {
      await result.current.sendMessage("Hi!");
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.status).toBe("idle");
  });
});
