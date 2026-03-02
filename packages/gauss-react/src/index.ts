/**
 * @gauss-ai/react
 *
 * Pre-built React UI components for AI chat interfaces powered by Gauss.
 *
 * @example
 * ```tsx
 * import { ChatPanel } from "@gauss-ai/react";
 * import { useChat } from "@gauss-ai/chat";
 *
 * function App() {
 *   const { messages, sendMessage, status, stop } = useChat({ api: "/api/chat" });
 *
 *   return (
 *     <ChatPanel
 *       messages={messages}
 *       onSend={(text) => sendMessage(text)}
 *       status={status}
 *       onStop={stop}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// Components
export {
  AgentSelector,
  ChatInput,
  ChatPanel,
  MessageList,
  StreamingIndicator,
  ToolCallViewer,
} from "./components/index.js";

// Component prop types
export type {
  AgentSelectorProps,
  ChatInputProps,
  ChatPanelProps,
  MessageListProps,
  StreamingIndicatorProps,
  ToolCallViewerProps,
} from "./components/index.js";

// Theme
export { defaultTheme, themeToVars } from "./theme.js";
export type { GaussTheme } from "./theme.js";
