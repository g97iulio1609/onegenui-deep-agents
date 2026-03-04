import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("useAgent (enhanced)", () => {
  it("initializes with extended state", () => {
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        agent: "assistant",
        sessionId: "sess-1",
      }),
    );

    expect(result.current.thinking).toBeNull();
    expect(result.current.activeTools).toEqual([]);
    expect(result.current.cost).toBeNull();
    expect(result.current.trace).toBeNull();
    expect(result.current.agentStatus).toBe("idle");
    expect(result.current.agent).toBe("assistant");
    expect(result.current.sessionId).toBe("sess-1");
  });

  it("sends messages and preserves base useChat behavior", async () => {
    const transport = createMockTransport([
      { type: "text-delta", text: "Agent response" },
    ]);

    const { result } = renderHook(() =>
      useAgent({ transport, agent: "test" }),
    );

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[1].role).toBe("assistant");
  });

  it("processAgentEvent handles thinking events", () => {
    const onThinking = vi.fn();
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        onThinking,
      }),
    );

    act(() => {
      result.current.processAgentEvent({ type: "thinking", text: "Let me think..." });
    });

    expect(result.current.thinking).toBe("Let me think...");
    expect(result.current.agentStatus).toBe("thinking");
    expect(onThinking).toHaveBeenCalledWith("Let me think...");
  });

  it("processAgentEvent handles tool-call and tool-result", () => {
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        onToolCall,
        onToolResult,
      }),
    );

    act(() => {
      result.current.processAgentEvent({
        type: "tool-call",
        toolName: "search",
        toolCallId: "tc-1",
        args: { query: "test" },
      });
    });

    expect(result.current.activeTools).toHaveLength(1);
    expect(result.current.activeTools[0].toolName).toBe("search");
    expect(result.current.agentStatus).toBe("calling-tool");
    expect(onToolCall).toHaveBeenCalledWith("search", { query: "test" });

    act(() => {
      result.current.processAgentEvent({
        type: "tool-result",
        toolCallId: "tc-1",
        result: { data: "found" },
      });
    });

    expect(result.current.activeTools[0].result).toEqual({ data: "found" });
    expect(result.current.agentStatus).toBe("streaming");
    expect(onToolResult).toHaveBeenCalledWith("search", { data: "found" });
  });

  it("processAgentEvent handles cost events", () => {
    const onCostUpdate = vi.fn();
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        onCostUpdate,
      }),
    );

    act(() => {
      result.current.processAgentEvent({
        type: "cost",
        totalUsd: 0.05,
        stepCosts: [0.02, 0.03],
      });
    });

    expect(result.current.cost).toEqual({
      totalUsd: 0.05,
      stepCosts: [0.02, 0.03],
    });
    expect(onCostUpdate).toHaveBeenCalledWith({
      totalUsd: 0.05,
      stepCosts: [0.02, 0.03],
    });
  });

  it("processAgentEvent handles trace events", () => {
    const onTraceUpdate = vi.fn();
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        onTraceUpdate,
      }),
    );

    const traceData = {
      spans: [{ name: "llm.call", startMs: 0, endMs: 100 }],
      totalDurationMs: 100,
    };

    act(() => {
      result.current.processAgentEvent({ type: "trace", trace: traceData });
    });

    expect(result.current.trace).toEqual(traceData);
    expect(onTraceUpdate).toHaveBeenCalledWith(traceData);
  });

  it("reset clears all extended state", async () => {
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([{ type: "text-delta", text: "hi" }]),
        agent: "test",
      }),
    );

    // Set some state
    act(() => {
      result.current.processAgentEvent({ type: "thinking", text: "hmm" });
      result.current.processAgentEvent({
        type: "cost",
        totalUsd: 0.01,
        stepCosts: [0.01],
      });
    });

    expect(result.current.thinking).toBe("hmm");
    expect(result.current.cost).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.thinking).toBeNull();
    expect(result.current.activeTools).toEqual([]);
    expect(result.current.cost).toBeNull();
    expect(result.current.trace).toBeNull();
    expect(result.current.agentStatus).toBe("idle");
    expect(result.current.messages).toEqual([]);
  });

  it("setAgent switches agent", () => {
    const { result } = renderHook(() =>
      useAgent({
        transport: createMockTransport([]),
        agent: "initial",
      }),
    );

    expect(result.current.agent).toBe("initial");

    act(() => {
      result.current.setAgent("switched");
    });

    expect(result.current.agent).toBe("switched");
  });

  it("works without any options", () => {
    const { result } = renderHook(() => useAgent());
    expect(result.current.agent).toBeUndefined();
    expect(result.current.agentStatus).toBe("idle");
  });

  it("text-delta event sets agentStatus to streaming", () => {
    const { result } = renderHook(() =>
      useAgent({ transport: createMockTransport([]) }),
    );

    act(() => {
      result.current.processAgentEvent({ type: "text-delta", text: "hi" });
    });

    expect(result.current.agentStatus).toBe("streaming");
  });
});
