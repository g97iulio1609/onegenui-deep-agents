/**
 * @gauss-ai/react
 *
 * Pre-built React UI components for AI chat interfaces powered by Gauss.
 *
 * @example
 * ```tsx
 * // Plug-and-play — zero wiring:
 * import { GaussChat } from "@gauss-ai/react";
 *
 * export default function Page() {
 *   return <GaussChat api="/api/chat" />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Floating widget:
 * import { GaussChatWindow, darkTheme } from "@gauss-ai/react";
 *
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <GaussChatWindow api="/api/chat" theme={darkTheme} title="Support" />
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Composable — bring your own hooks:
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

// ── Plug-and-Play Widgets ────────────────────────────────────────────────────
export { GaussChat } from "./components/gauss-chat.js";
export type { GaussChatProps } from "./components/gauss-chat.js";

export { GaussChatWindow } from "./components/gauss-chat-window.js";
export type { GaussChatWindowProps } from "./components/gauss-chat-window.js";

// ── Composable Components ────────────────────────────────────────────────────
export {
  AgentSelector,
  ChatInput,
  ChatPanel,
  ConversationList,
  FileUpload,
  MarkdownRenderer,
  MessageList,
  StreamingIndicator,
  SyntaxHighlighter,
  ToolCallViewer,
  createCodeBlockRenderer,
} from "./components/index.js";

// Component prop types
export type {
  AgentSelectorProps,
  ChatInputProps,
  ChatPanelProps,
  ConversationListProps,
  ConversationItem,
  FileUploadProps,
  MarkdownRendererProps,
  MessageListProps,
  StreamingIndicatorProps,
  SyntaxHighlighterProps,
  ToolCallViewerProps,
} from "./components/index.js";

// ── Theme ────────────────────────────────────────────────────────────────────
export { defaultTheme, themeToVars } from "./theme.js";
export type { GaussTheme } from "./theme.js";

// ── Theme Presets ────────────────────────────────────────────────────────────
export {
  lightTheme,
  darkTheme,
  minimalTheme,
  glassTheme,
  themePresets,
} from "./presets.js";
export type { ThemePresetName } from "./presets.js";
