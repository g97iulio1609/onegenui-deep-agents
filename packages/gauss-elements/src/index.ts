/**
 * @gauss-ai/elements
 *
 * Composable AI UI primitives for React — styled by default, headless when needed.
 *
 * @example
 * ```tsx
 * import { AIMessage, AIInput, AICodeBlock } from "@gauss-ai/elements";
 * import "@gauss-ai/elements/styles.css"; // Optional — default styles
 *
 * function Chat() {
 *   return (
 *     <div>
 *       <AIMessage role="assistant">Hello! How can I help?</AIMessage>
 *       <AIMessage role="user">Write a function</AIMessage>
 *       <AICodeBlock code="function hello() {}" language="typescript" />
 *       <AIInput onSend={handleSend} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// ── Components ────────────────────────────────────────────────────────────────
export { AIAvatar } from "./components/ai-avatar.js";
export type { AIAvatarProps } from "./components/ai-avatar.js";

export { AIMessage } from "./components/ai-message.js";
export type { AIMessageProps } from "./components/ai-message.js";

export { AIInput } from "./components/ai-input.js";
export type { AIInputProps } from "./components/ai-input.js";

export { AIToolCall } from "./components/ai-tool-call.js";
export type { AIToolCallProps } from "./components/ai-tool-call.js";

export { AICodeBlock } from "./components/ai-code-block.js";
export type { AICodeBlockProps } from "./components/ai-code-block.js";

export { AISuggestions } from "./components/ai-suggestions.js";
export type { AISuggestionsProps, Suggestion } from "./components/ai-suggestions.js";

export { AITypingIndicator } from "./components/ai-typing-indicator.js";
export type { AITypingIndicatorProps } from "./components/ai-typing-indicator.js";

// ── Types ────────────────────────────────────────────────────────────────────
export type { MessageRole, ToolCallStatus, ElementBaseProps } from "./types.js";

// ── Utilities ────────────────────────────────────────────────────────────────
export { cx } from "./utils.js";
