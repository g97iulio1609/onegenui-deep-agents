/**
 * AITypingIndicator — Animated typing dots.
 */

import React from "react";
import type { ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";

export interface AITypingIndicatorProps extends ElementBaseProps {
  /** Whether to show the indicator. */
  isActive: boolean;
  /** Custom text label. Default: none (dots only). */
  label?: string;
  /** Number of dots. Default: 3. */
  dots?: number;
  /** Dot size in pixels. Default: 6. */
  dotSize?: number;
  /** Animation speed in ms. Default: 400. */
  speed?: number;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

export function AITypingIndicator({
  isActive,
  label,
  dots = 3,
  dotSize = 6,
  speed = 400,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-typing-indicator",
}: AITypingIndicatorProps): React.JSX.Element | null {
  if (!isActive) return null;

  const containerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        fontSize: "13px",
        color: "#6b7280",
      };

  const dotsContainerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
      };

  return (
    <div
      className={cx("ai-typing-indicator", className)}
      data-testid={testId}
      role="status"
      aria-label="Typing"
      style={{ ...containerStyle, ...style }}
    >
      {label && <span>{label}</span>}
      <span style={dotsContainerStyle}>
        {Array.from({ length: dots }, (_, i) => (
          <span
            key={i}
            data-testid="ai-typing-dot"
            style={
              unstyled
                ? undefined
                : {
                    width: dotSize,
                    height: dotSize,
                    borderRadius: "50%",
                    backgroundColor: "#9ca3af",
                    animation: `ai-typing-bounce ${speed}ms ease-in-out ${i * (speed / dots)}ms infinite`,
                    display: "inline-block",
                  }
            }
          />
        ))}
      </span>
    </div>
  );
}
