import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStreamStatus } from "../hooks/use-stream-status.js";

describe("useStreamStatus", () => {
  it('should return isIdle=true when status is "idle"', () => {
    const { result } = renderHook(() => useStreamStatus("idle"));
    expect(result.current).toEqual({
      status: "idle",
      isIdle: true,
      isLoading: false,
      isStreaming: false,
      isError: false,
      isActive: false,
    });
  });

  it('should return isLoading=true and isActive=true when status is "loading"', () => {
    const { result } = renderHook(() => useStreamStatus("loading"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isActive).toBe(true);
    expect(result.current.isIdle).toBe(false);
  });

  it('should return isStreaming=true and isActive=true when status is "streaming"', () => {
    const { result } = renderHook(() => useStreamStatus("streaming"));
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it('should return isError=true when status is "error"', () => {
    const { result } = renderHook(() => useStreamStatus("error"));
    expect(result.current.isError).toBe(true);
    expect(result.current.isActive).toBe(false);
  });

  it("should update when status changes", () => {
    const { result, rerender } = renderHook(({ s }) => useStreamStatus(s), {
      initialProps: { s: "idle" as const },
    });
    expect(result.current.isIdle).toBe(true);
    rerender({ s: "streaming" as const });
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.isIdle).toBe(false);
  });
});
