import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCompletion } from "../hooks/use-completion.js";
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

describe("useCompletion", () => {
  it("should initialize with empty completion", () => {
    const { result } = renderHook(() =>
      useCompletion({ transport: createMockTransport([]) }),
    );

    expect(result.current.completion).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("should complete a prompt with streaming", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "The answer" },
      { type: "text-delta", text: " is 42" },
      { type: "finish", finishReason: "stop" },
    ]);

    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompletion({ transport, onFinish }),
    );

    await act(async () => {
      await result.current.complete("What is the meaning of life?");
    });

    expect(result.current.completion).toBe("The answer is 42");
    expect(result.current.status).toBe("idle");
    expect(onFinish).toHaveBeenCalled();
  });

  it("should handle errors", async () => {
    const transport: ChatTransport = {
      async *send() {
        yield { type: "error" as const, error: "Failed" };
      },
    };

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useCompletion({ transport, onError }),
    );

    await act(async () => {
      await result.current.complete("test");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Failed");
    expect(onError).toHaveBeenCalled();
  });

  it("should stop streaming on abort", async () => {
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

    const { result } = renderHook(() => useCompletion({ transport }));

    await act(async () => {
      const p = result.current.complete("test");
      await new Promise((r) => setTimeout(r, 10));
      result.current.stop();
      await p;
    });

    expect(result.current.status).toBe("idle");
  });

  it("should reset completion on new call", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "New response" },
    ]);

    const { result } = renderHook(() => useCompletion({ transport }));

    await act(async () => {
      await result.current.complete("First");
    });

    expect(result.current.completion).toBe("New response");

    // The completion resets at the start of each call
    const transport2 = createMockTransport([
      { type: "text-delta", text: "Second" },
    ]);

    const { result: result2 } = renderHook(() =>
      useCompletion({ transport: transport2 }),
    );

    await act(async () => {
      await result2.current.complete("Second");
    });

    expect(result2.current.completion).toBe("Second");
  });
});
