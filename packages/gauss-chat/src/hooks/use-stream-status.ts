import { useMemo } from "react";
import type { ChatStatus } from "../types/index.js";

/** Derived stream status with convenience booleans. */
export interface StreamStatus {
  /** Raw chat status value. */
  status: ChatStatus;
  /** True when status is "idle". */
  isIdle: boolean;
  /** True when status is "loading". */
  isLoading: boolean;
  /** True when status is "streaming". */
  isStreaming: boolean;
  /** True when status is "error". */
  isError: boolean;
  /** True when either loading or streaming (i.e. request in progress). */
  isActive: boolean;
}

/**
 * Derives convenience booleans from a `ChatStatus` value.
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, status } = useChat({ api: "/api/chat" });
 * const { isStreaming, isActive } = useStreamStatus(status);
 *
 * return (
 *   <button disabled={isActive} onClick={() => sendMessage("hi")}>
 *     {isStreaming ? "Streaming…" : "Send"}
 *   </button>
 * );
 * ```
 */
export function useStreamStatus(status: ChatStatus): StreamStatus {
  return useMemo<StreamStatus>(
    () => ({
      status,
      isIdle: status === "idle",
      isLoading: status === "loading",
      isStreaming: status === "streaming",
      isError: status === "error",
      isActive: status === "loading" || status === "streaming",
    }),
    [status],
  );
}
