import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTokenCount } from "../hooks/use-token-count.js";
import type { ChatMessage } from "../types/index.js";

function msg(role: string, text: string): ChatMessage {
  return { id: `${role}-1`, role, parts: [{ type: "text", text }] } as ChatMessage;
}

describe("useTokenCount", () => {
  it("should return zero for empty messages", () => {
    const { result } = renderHook(() => useTokenCount([]));
    expect(result.current.total).toBe(0);
    expect(result.current.byRole).toEqual({});
    expect(result.current.isOverLimit).toBe(false);
    expect(result.current.percentUsed).toBeNaN();
  });

  it("should estimate tokens based on character count", () => {
    // 20 characters / 4 chars per token = 5 tokens
    const messages = [msg("user", "Hello World 12345678")];
    const { result } = renderHook(() => useTokenCount(messages));
    expect(result.current.total).toBe(5);
    expect(result.current.byRole).toEqual({ user: 5 });
  });

  it("should aggregate tokens by role", () => {
    const messages = [
      msg("user", "Hello World!"),      // 12 chars → 3 tokens
      msg("assistant", "Hi there!"),     // 9 chars → 3 tokens (ceil)
      msg("user", "How are you?"),       // 12 chars → 3 tokens
    ];
    const { result } = renderHook(() => useTokenCount(messages));
    expect(result.current.total).toBe(9);
    expect(result.current.byRole.user).toBe(6);
    expect(result.current.byRole.assistant).toBe(3);
  });

  it("should detect over-limit when limit is provided", () => {
    const messages = [msg("user", "Hello World 12345678")]; // 5 tokens
    const { result } = renderHook(() => useTokenCount(messages, 3));
    expect(result.current.isOverLimit).toBe(true);
    expect(result.current.percentUsed).toBeGreaterThan(100);
  });

  it("should calculate percentUsed correctly", () => {
    const messages = [msg("user", "Hello World 12345678")]; // 5 tokens
    const { result } = renderHook(() => useTokenCount(messages, 10));
    expect(result.current.percentUsed).toBe(50);
    expect(result.current.isOverLimit).toBe(false);
  });

  it("should handle messages with no text parts", () => {
    const message: ChatMessage = {
      id: "1",
      role: "assistant",
      parts: [{ type: "tool-call", toolName: "search", toolCallId: "tc1", args: {} }],
    } as ChatMessage;
    const { result } = renderHook(() => useTokenCount([message]));
    expect(result.current.total).toBe(0);
  });
});
