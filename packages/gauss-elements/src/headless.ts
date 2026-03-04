/**
 * @gauss-ai/elements/headless
 *
 * Unstyled (headless) versions of all AI elements.
 * Import from this entry point for full styling control.
 *
 * @example
 * ```tsx
 * import { AIMessage, AIInput } from "@gauss-ai/elements/headless";
 *
 * // All components render with unstyled=true by default
 * ```
 */

// Re-export everything from main index — consumers use unstyled prop or
// this entry point documents the headless pattern.
export {
  AIAvatar,
  AIMessage,
  AIInput,
  AIToolCall,
  AICodeBlock,
  AISuggestions,
  AITypingIndicator,
} from "./index.js";

export type {
  AIAvatarProps,
  AIMessageProps,
  AIInputProps,
  AIToolCallProps,
  AICodeBlockProps,
  AISuggestionsProps,
  Suggestion,
  AITypingIndicatorProps,
  MessageRole,
  ToolCallStatus,
  ElementBaseProps,
} from "./index.js";

export { cx } from "./utils.js";
