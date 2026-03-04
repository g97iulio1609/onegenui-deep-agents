/**
 * AIMessage — Themed message bubble with role-based styling.
 *
 * Renders a chat message with avatar, content, and optional timestamp.
 */

import React from "react";
import type { MessageRole, ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";
import { AIAvatar } from "./ai-avatar.js";

export interface AIMessageProps extends ElementBaseProps {
  /** Message role. */
  role: MessageRole;
  /** Message content (text or custom elements). */
  children: React.ReactNode;
  /** Avatar image URL. */
  avatar?: string;
  /** Display name (shown above the message). */
  name?: string;
  /** Timestamp string. */
  timestamp?: string;
  /** Whether this message is currently streaming. */
  isStreaming?: boolean;
  /** Actions to display (e.g., copy, retry buttons). */
  actions?: React.ReactNode;
  /** Custom avatar render. */
  renderAvatar?: (role: MessageRole) => React.ReactNode;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

export function AIMessage({
  role,
  children,
  avatar,
  name,
  timestamp,
  isStreaming = false,
  actions,
  renderAvatar,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-message",
}: AIMessageProps): React.JSX.Element {
  const isUser = role === "user";

  const wrapperStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        gap: "12px",
        padding: "12px 0",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
      };

  const bubbleStyle: React.CSSProperties = unstyled
    ? {}
    : {
        maxWidth: "80%",
        padding: "10px 16px",
        borderRadius: "16px",
        backgroundColor: isUser ? "#6366f1" : "#f3f4f6",
        color: isUser ? "#fff" : "#111827",
        lineHeight: 1.6,
        fontSize: "14px",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
        ...(isStreaming ? { opacity: 0.9 } : {}),
      };

  const metaStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        fontSize: "12px",
        color: "#9ca3af",
        marginBottom: "4px",
        flexDirection: isUser ? "row-reverse" : "row",
      };

  const actionsStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        gap: "4px",
        marginTop: "4px",
        opacity: 0.6,
        justifyContent: isUser ? "flex-end" : "flex-start",
      };

  return (
    <div
      className={cx("ai-message", `ai-message--${role}`, className)}
      data-testid={testId}
      data-role={role}
      data-streaming={isStreaming || undefined}
      style={{ ...wrapperStyle, ...style }}
    >
      {renderAvatar ? (
        renderAvatar(role)
      ) : (
        <AIAvatar role={role} src={avatar} size={28} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {(name || timestamp) && (
          <div style={metaStyle}>
            {name && <span style={{ fontWeight: 600 }}>{name}</span>}
            {timestamp && <time>{timestamp}</time>}
          </div>
        )}
        <div className="ai-message__bubble" style={bubbleStyle}>
          {children}
        </div>
        {actions && <div style={actionsStyle}>{actions}</div>}
      </div>
    </div>
  );
}
