import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAgent } from "../hooks/use-agent.js";
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

describe("useAgent", () => {
  it("should initialize with agent and sessionId", () => {
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        agent: "code-reviewer",
        sessionId: "sess-123",
      }),
    );

    expect(result.current.agent).toBe("code-reviewer");
    expect(result.current.sessionId).toBe("sess-123");
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
  });

  it("should allow switching agents", () => {
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        agent: "code-reviewer",
      }),
    );

    expect(result.current.agent).toBe("code-reviewer");

    act(() => {
      result.current.setAgent("assistant");
    });

    expect(result.current.agent).toBe("assistant");
  });

  it("should send messages with agent context", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Agent response" },
    ]);

    const { result } = renderHook(() =>
      useAgent({
        transport,
        agent: "code-reviewer",
        enableMemory: true,
      }),
    );

    await act(async () => {
      await result.current.sendMessage("Review this code");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[1].role).toBe("assistant");
  });

  it("should reset like useChat", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Hello" },
    ]);

    const { result } = renderHook(() =>
      useAgent({ transport, agent: "test" }),
    );

    await act(async () => {
      await result.current.sendMessage("Hi!");
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toEqual([]);
  });

  it("should work without agent specified", () => {
    const { result } = renderHook(() =>
      useAgent({ transport: createMockTransport([]) }),
    );

    expect(result.current.agent).toBeUndefined();
    expect(result.current.sessionId).toBeUndefined();
  });
});
