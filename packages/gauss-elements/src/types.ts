/**
 * Shared types for @gauss-ai/elements.
 */

/** Message role. */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/** Tool call status. */
export type ToolCallStatus = "pending" | "running" | "success" | "error";

/** Base props shared by all elements. */
export interface ElementBaseProps {
  /** CSS class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** data-testid for testing. */
  "data-testid"?: string;
}
