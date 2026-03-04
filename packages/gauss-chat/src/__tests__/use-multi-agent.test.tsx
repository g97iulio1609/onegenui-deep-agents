import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMultiAgent, type AgentConfig } from "../hooks/use-multi-agent.js";
import type { ChatMessage } from "../types/index.js";

/* ── Mock useChat ─────────────────────────────────────────────────────────── */

const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockReset = vi.fn();
let lastUseChatOptions: Record<string, unknown> = {};

vi.mock("../hooks/use-chat.js", () => ({
  useChat: vi.fn((opts: Record<string, unknown>) => {
    lastUseChatOptions = opts;
    return {
      messages: [] as ChatMessage[],
      sendMessage: mockSendMessage,
      status: "idle" as const,
      error: null,
      stop: mockStop,
      reset: mockReset,
      isLoading: false,
    };
  }),
}));

const testAgents: AgentConfig[] = [
  { id: "coder", name: "Coder", api: "/api/agent/coder", systemPrompt: "You write code." },
  { id: "reviewer", name: "Reviewer", api: "/api/agent/reviewer" },
  { id: "writer", name: "Writer", api: "/api/agent/writer" },
];

beforeEach(() => {
  vi.clearAllMocks();
  lastUseChatOptions = {};
});

describe("useMultiAgent", () => {
  it("should initialize with the first agent as active", () => {
    const { result } = renderHook(() => useMultiAgent({ agents: testAgents }));
    expect(result.current.activeAgent.id).toBe("coder");
    expect(result.current.agents).toHaveLength(3);
  });

  it("should initialize with defaultAgent if provided", () => {
    const { result } = renderHook(() =>
      useMultiAgent({ agents: testAgents, defaultAgent: "reviewer" }),
    );
    expect(result.current.activeAgent.id).toBe("reviewer");
  });

  it("should switch agents with switchAgent", () => {
    const { result } = renderHook(() => useMultiAgent({ agents: testAgents }));
    expect(result.current.activeAgent.id).toBe("coder");

    act(() => {
      result.current.switchAgent("writer");
    });

    expect(result.current.activeAgent.id).toBe("writer");
  });

  it("should pass active agent api to useChat", () => {
    renderHook(() => useMultiAgent({ agents: testAgents }));
    expect(lastUseChatOptions.api).toBe("/api/agent/coder");
  });

  it("should pass active agent systemPrompt to useChat", () => {
    renderHook(() => useMultiAgent({ agents: testAgents }));
    expect(lastUseChatOptions.systemPrompt).toBe("You write code.");
  });

  it("should include agentId in body", () => {
    renderHook(() => useMultiAgent({ agents: testAgents }));
    const body = lastUseChatOptions.body as Record<string, unknown>;
    expect(body.agentId).toBe("coder");
  });

  it("should call chat.sendMessage when sending a message", async () => {
    const { result } = renderHook(() => useMultiAgent({ agents: testAgents }));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });

  it("should track message counts per agent", async () => {
    const { result } = renderHook(() => useMultiAgent({ agents: testAgents }));

    await act(async () => {
      await result.current.sendMessage("First");
    });

    expect(result.current.messageCounts.coder).toBe(1);

    await act(async () => {
      await result.current.sendMessage("Second");
    });

    expect(result.current.messageCounts.coder).toBe(2);
    expect(result.current.messageCounts.reviewer ?? 0).toBe(0);
  });

  it("should ignore switchAgent with invalid id", () => {
    const { result } = renderHook(() => useMultiAgent({ agents: testAgents }));

    act(() => {
      result.current.switchAgent("nonexistent");
    });

    expect(result.current.activeAgent.id).toBe("coder");
  });

  it("should throw if agents array is empty", () => {
    expect(() => {
      renderHook(() => useMultiAgent({ agents: [] }));
    }).toThrow("useMultiAgent requires at least one agent configuration.");
  });
});
