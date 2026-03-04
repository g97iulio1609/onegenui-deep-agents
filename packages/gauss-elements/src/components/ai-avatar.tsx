/**
 * AIAvatar — Role-based avatar for chat messages.
 *
 * Renders an avatar with role-based default appearance and customizable fallback.
 */

import React from "react";
import type { MessageRole, ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";

export interface AIAvatarProps extends ElementBaseProps {
  /** Message role determines default icon/color. */
  role: MessageRole;
  /** Custom image URL. */
  src?: string;
  /** Alt text for the image. */
  alt?: string;
  /** Size in pixels. Default: 32. */
  size?: number;
  /** Custom fallback content (replaces default initials). */
  fallback?: React.ReactNode;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

const ROLE_COLORS: Record<MessageRole, string> = {
  user: "#6366f1",
  assistant: "#10b981",
  system: "#f59e0b",
  tool: "#8b5cf6",
};

const ROLE_INITIALS: Record<MessageRole, string> = {
  user: "U",
  assistant: "AI",
  system: "S",
  tool: "T",
};

export function AIAvatar({
  role,
  src,
  alt,
  size = 32,
  fallback,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-avatar",
}: AIAvatarProps): React.JSX.Element {
  const baseStyle: React.CSSProperties = unstyled
    ? {}
    : {
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 600,
        flexShrink: 0,
        overflow: "hidden",
        backgroundColor: ROLE_COLORS[role],
        color: "#fff",
      };

  if (src) {
    return (
      <div
        className={cx("ai-avatar", className)}
        data-testid={testId}
        data-role={role}
        style={{ ...baseStyle, ...style }}
      >
        <img
          src={src}
          alt={alt ?? role}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  return (
    <div
      className={cx("ai-avatar", className)}
      data-testid={testId}
      data-role={role}
      style={{ ...baseStyle, ...style }}
    >
      {fallback ?? ROLE_INITIALS[role]}
    </div>
  );
}
