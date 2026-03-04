/**
 * AIToolCall — Collapsible tool invocation card.
 *
 * Displays a tool call with status indicator, args, and optional result.
 */

import React, { useState } from "react";
import type { ToolCallStatus, ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";

export interface AIToolCallProps extends ElementBaseProps {
  /** Tool name. */
  toolName: string;
  /** Tool call ID. */
  toolCallId: string;
  /** Tool arguments. */
  args: Record<string, unknown>;
  /** Tool result (if available). */
  result?: unknown;
  /** Current status. */
  status?: ToolCallStatus;
  /** Whether to start expanded. Default: false. */
  defaultExpanded?: boolean;
  /** Custom status icon renderer. */
  renderStatusIcon?: (status: ToolCallStatus) => React.ReactNode;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

const STATUS_ICONS: Record<ToolCallStatus, string> = {
  pending: "⏳",
  running: "⚡",
  success: "✅",
  error: "❌",
};

const STATUS_COLORS: Record<ToolCallStatus, string> = {
  pending: "#f59e0b",
  running: "#6366f1",
  success: "#10b981",
  error: "#ef4444",
};

export function AIToolCall({
  toolName,
  toolCallId,
  args,
  result,
  status = "success",
  defaultExpanded = false,
  renderStatusIcon,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-tool-call",
}: AIToolCallProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const containerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        overflow: "hidden",
        fontSize: "13px",
        fontFamily: "system-ui, sans-serif",
      };

  const headerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        cursor: "pointer",
        backgroundColor: "#f9fafb",
        borderBottom: expanded ? "1px solid #e5e7eb" : "none",
        userSelect: "none",
      };

  const codeStyle: React.CSSProperties = unstyled
    ? {}
    : {
        padding: "12px",
        margin: 0,
        fontSize: "12px",
        fontFamily: "ui-monospace, monospace",
        backgroundColor: "#f9fafb",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      };

  return (
    <div
      className={cx("ai-tool-call", className)}
      data-testid={testId}
      data-status={status}
      style={{ ...containerStyle, ...style }}
    >
      <div
        style={headerStyle}
        onClick={() => setExpanded((p) => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((p) => !p);
          }
        }}
        aria-expanded={expanded}
      >
        <span style={{ color: STATUS_COLORS[status] }}>
          {renderStatusIcon ? renderStatusIcon(status) : STATUS_ICONS[status]}
        </span>
        <span style={{ fontWeight: 600 }}>{toolName}</span>
        <span style={{ color: "#9ca3af", fontSize: "11px", marginLeft: "auto" }}>
          {expanded ? "▾" : "▸"} {toolCallId.slice(0, 8)}
        </span>
      </div>

      {expanded && (
        <div data-testid="ai-tool-call-body">
          <div style={{ borderBottom: result !== undefined ? "1px solid #e5e7eb" : "none" }}>
            <div style={{ padding: "4px 12px 0", fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>
              Arguments
            </div>
            <pre style={codeStyle}>{JSON.stringify(args, null, 2)}</pre>
          </div>
          {result !== undefined && (
            <div>
              <div style={{ padding: "4px 12px 0", fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                Result
              </div>
              <pre style={codeStyle} data-testid="ai-tool-call-result">
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
