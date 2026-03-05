/**
 * GaussChatWindow — Floating/popup chat widget.
 *
 * Renders a toggle button and a floating chat panel that expands
 * from the corner of the screen (like Intercom, Drift, etc.).
 *
 * @example
 * ```tsx
 * import { GaussChatWindow } from "@gauss-ai/react";
 *
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <GaussChatWindow api="/api/chat" title="Gauss Assistant" />
 *     </>
 *   );
 * }
 * ```
 */
import React, { useCallback, useState } from "react";
import type { ChatMessage, ChatTransport } from "@gauss-ai/chat";
import type { GaussTheme } from "../theme.js";
import { themeToVars } from "../theme.js";
import { GaussChat } from "./gauss-chat.js";

export interface GaussChatWindowProps {
  /** API endpoint. Default: "/api/chat". */
  api?: string;
  /** Custom headers. */
  headers?: Record<string, string>;
  /** Extra body data. */
  body?: Record<string, unknown>;
  /** Custom transport. */
  transport?: ChatTransport;
  /** System prompt. */
  systemPrompt?: string;
  /** Initial messages. */
  initialMessages?: ChatMessage[];
  /** Visual theme. */
  theme?: GaussTheme;
  /** Input placeholder. */
  placeholder?: string;
  /** Window title displayed in the header bar. Default: "Chat". */
  title?: string;
  /** Subtitle shown under title. */
  subtitle?: string;
  /** Position on screen. Default: "bottom-right". */
  position?: "bottom-right" | "bottom-left";
  /** Width of the chat window. Default: "380px". */
  width?: string;
  /** Height of the chat window. Default: "520px". */
  height?: string;
  /** Whether the window starts open. Default: false. */
  defaultOpen?: boolean;
  /** Called on error. */
  onError?: (error: Error) => void;
  /** Called when a response finishes. */
  onFinish?: (message: ChatMessage) => void;
  /** Custom toggle button renderer. Return a button element. */
  renderToggle?: (isOpen: boolean, toggle: () => void) => React.ReactNode;
  /** CSS class name for the root wrapper. */
  className?: string;
  /** Custom launcher icon (emoji, SVG, or React element). Default: 💬. */
  launcherIcon?: React.ReactNode;
  /** Custom launcher close icon. Default: ✕. */
  launcherCloseIcon?: React.ReactNode;
  /** Badge count shown on the launcher. */
  badgeCount?: number;
  /** Called when window opens. */
  onOpen?: () => void;
  /** Called when window closes. */
  onClose?: () => void;
  /** Suggested prompts for empty state. */
  suggestions?: Array<{ id: string; label: string; prompt?: string }>;
  /** Welcome message. */
  welcomeMessage?: string;
  /** Footer content. */
  footer?: React.ReactNode;
  /** Slot rendered before the text input (e.g. file upload). */
  inputStartSlot?: React.ReactNode;
  /** Slot rendered after the send button (e.g. voice input). */
  inputEndSlot?: React.ReactNode;
  /** Render assistant messages as Markdown. Default: false. */
  markdown?: boolean;
}

/** Floating chat window with toggle button. */
export function GaussChatWindow({
  api,
  headers,
  body,
  transport,
  systemPrompt,
  initialMessages,
  theme,
  placeholder,
  title = "Chat",
  subtitle,
  position = "bottom-right",
  width = "380px",
  height = "520px",
  defaultOpen = false,
  onError,
  onFinish,
  renderToggle,
  className,
  launcherIcon = "💬",
  launcherCloseIcon = "✕",
  badgeCount,
  onOpen,
  onClose,
  suggestions,
  welcomeMessage,
  footer,
  inputStartSlot,
  inputEndSlot,
  markdown,
}: GaussChatWindowProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      else onClose?.();
      return next;
    });
  }, [onOpen, onClose]);

  const vars = theme ? themeToVars(theme) : {};
  const isRight = position === "bottom-right";

  const windowStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "80px",
    [isRight ? "right" : "left"]: "20px",
    width,
    height,
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18)",
    display: isOpen ? "flex" : "none",
    flexDirection: "column",
    zIndex: 9999,
    border: "1px solid rgba(0, 0, 0, 0.08)",
    ...vars,
  } as React.CSSProperties;

  const headerBar = (
    <div style={headerBarStyle}>
      <div>
        <span style={titleStyle}>{title}</span>
        {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
      </div>
      <button
        onClick={toggle}
        style={closeButtonStyle}
        data-testid="gauss-chat-window-close"
        type="button"
        aria-label="Close chat"
      >
        ✕
      </button>
    </div>
  );

  const fabStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "20px",
    [isRight ? "right" : "left"]: "20px",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: theme?.primaryColor ?? "#6366f1",
    color: "#fff",
    cursor: "pointer",
    fontSize: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
    zIndex: 9998,
    transition: "transform 0.2s ease",
  };

  return (
    <div data-testid="gauss-chat-window" className={className}>
      <div style={windowStyle} data-testid="gauss-chat-window-panel">
        <GaussChat
          api={api}
          headers={headers}
          body={body}
          transport={transport}
          systemPrompt={systemPrompt}
          initialMessages={initialMessages}
          theme={theme}
          placeholder={placeholder}
          header={headerBar}
          onError={onError}
          onFinish={onFinish}
          suggestions={suggestions}
          welcomeMessage={welcomeMessage}
          footer={footer}
          inputStartSlot={inputStartSlot}
          inputEndSlot={inputEndSlot}
          markdown={markdown}
          style={{ borderRadius: "16px" }}
        />
      </div>

      {renderToggle ? (
        renderToggle(isOpen, toggle)
      ) : (
        <button
          onClick={toggle}
          style={fabStyle}
          data-testid="gauss-chat-window-toggle"
          type="button"
          aria-label={isOpen ? "Close chat" : "Open chat"}
        >
          {isOpen ? launcherCloseIcon : launcherIcon}
          {!isOpen && badgeCount != null && badgeCount > 0 && (
            <span style={badgeStyle} data-testid="gauss-chat-window-badge">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const headerBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0",
};

const titleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
};

const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
  padding: "4px",
  lineHeight: 1,
  color: "inherit",
  opacity: 0.6,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  marginTop: "2px",
};

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: "-4px",
  right: "-4px",
  minWidth: "20px",
  height: "20px",
  borderRadius: "10px",
  backgroundColor: "#ef4444",
  color: "#fff",
  fontSize: "11px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 4px",
  lineHeight: 1,
};
