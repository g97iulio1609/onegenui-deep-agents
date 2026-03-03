import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useObject } from "../hooks/use-object.js";
import type { ChatTransport, ObjectSchema, StreamEvent } from "../types/index.js";

interface TestUser {
  name: string;
  age: number;
}

const userSchema: ObjectSchema<TestUser> = {
  parse: (input: unknown) => {
    const obj = input as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.age !== "number") {
      throw new Error("Invalid user object");
    }
    return { name: obj.name, age: obj.age };
  },
};

function createMockTransport(events: StreamEvent[]): ChatTransport {
  return {
    async *send() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

describe("useObject", () => {
  it("should initialize with undefined object", () => {
    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport: createMockTransport([]) }),
    );

    expect(result.current.object).toBeUndefined();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("should stream and parse a complete JSON object", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: '{"name":"Alice"' },
      { type: "text-delta", text: ',"age":30}' },
      { type: "finish", finishReason: "stop" },
    ]);

    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport, onFinish }),
    );

    await act(async () => {
      await result.current.submit("Generate a user");
    });

    expect(result.current.object).toEqual({ name: "Alice", age: 30 });
    expect(result.current.status).toBe("idle");
    expect(onFinish).toHaveBeenCalled();
  });

  it("should handle partial JSON gracefully", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: '{"name' },
      { type: "text-delta", text: '":"Bob","age":25}' },
      { type: "finish", finishReason: "stop" },
    ]);

    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport }),
    );

    await act(async () => {
      await result.current.submit("Generate a user");
    });

    expect(result.current.object).toEqual({ name: "Bob", age: 25 });
  });

  it("should handle streaming errors", async () => {
    const transport: ChatTransport = {
      async *send() {
        yield { type: "error" as const, error: "Server error" };
      },
    };

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport, onError }),
    );

    await act(async () => {
      await result.current.submit("test");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Server error");
    expect(onError).toHaveBeenCalled();
  });

  it("should error when final JSON is invalid", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "not valid json" },
      { type: "finish", finishReason: "stop" },
    ]);

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport, onError }),
    );

    await act(async () => {
      await result.current.submit("test");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).not.toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it("should error when schema validation fails on final object", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: '{"name":123}' },
      { type: "finish", finishReason: "stop" },
    ]);

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport, onError }),
    );

    await act(async () => {
      await result.current.submit("test");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toContain("Failed to parse final object");
    expect(onError).toHaveBeenCalled();
  });

  it("should stop streaming on abort", async () => {
    const transport: ChatTransport = {
      async *send(_msgs, opts) {
        yield { type: "text-delta" as const, text: '{"name":"A' };
        await new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      },
    };

    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport }),
    );

    await act(async () => {
      const p = result.current.submit("test");
      await new Promise((r) => setTimeout(r, 10));
      result.current.stop();
      await p;
    });

    expect(result.current.status).toBe("idle");
  });

  it("should reset object on new submit", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: '{"name":"Carol","age":40}' },
      { type: "finish", finishReason: "stop" },
    ]);

    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport }),
    );

    await act(async () => {
      await result.current.submit("First");
    });

    expect(result.current.object).toEqual({ name: "Carol", age: 40 });

    const transport2 = createMockTransport([
      { type: "text-delta", text: '{"name":"Dave","age":50}' },
      { type: "finish", finishReason: "stop" },
    ]);

    const { result: result2 } = renderHook(() =>
      useObject({ schema: userSchema, transport: transport2 }),
    );

    await act(async () => {
      await result2.current.submit("Second");
    });

    expect(result2.current.object).toEqual({ name: "Dave", age: 50 });
  });

  it("should progressively update with valid partials", async () => {
    const objectUpdates: (TestUser | undefined)[] = [];

    const transport: ChatTransport = {
      async *send() {
        yield { type: "text-delta" as const, text: '{"name":"Eve","age":' };
        yield { type: "text-delta" as const, text: "28}" };
        yield { type: "finish" as const, finishReason: "stop" };
      },
    };

    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport }),
    );

    await act(async () => {
      await result.current.submit("test");
    });

    // Final object should be fully valid
    expect(result.current.object).toEqual({ name: "Eve", age: 28 });
  });

  it("should send schema:json in request body", async () => {
    const sendSpy = vi.fn(async function* () {
      yield { type: "text-delta" as const, text: '{"name":"F","age":1}' };
      yield { type: "finish" as const, finishReason: "stop" };
    });

    const transport: ChatTransport = { send: sendSpy };

    const { result } = renderHook(() =>
      useObject({ schema: userSchema, transport }),
    );

    await act(async () => {
      await result.current.submit("test");
    });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        body: expect.objectContaining({ schema: "json" }),
      }),
    );
  });
});
