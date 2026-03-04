/**
 * AISuggestions — Suggested prompt chips/pills.
 *
 * Renders a row of clickable suggestion chips that users can tap to populate input.
 */

import React from "react";
import type { ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";

export interface Suggestion {
  /** Unique identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional icon (emoji or ReactNode). */
  icon?: React.ReactNode;
  /** Full prompt text (if different from label). */
  prompt?: string;
}

export interface AISuggestionsProps extends ElementBaseProps {
  /** Suggestion items. */
  suggestions: Suggestion[];
  /** Callback when a suggestion is clicked. Receives the prompt text. */
  onSelect: (prompt: string) => void;
  /** Orientation. Default: "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Custom chip renderer. */
  renderChip?: (suggestion: Suggestion, onClick: () => void) => React.ReactNode;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

export function AISuggestions({
  suggestions,
  onSelect,
  orientation = "horizontal",
  renderChip,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-suggestions",
}: AISuggestionsProps): React.JSX.Element {
  const containerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        flexDirection: orientation === "vertical" ? "column" : "row",
        flexWrap: orientation === "horizontal" ? "wrap" : "nowrap",
        gap: "8px",
        padding: "8px 0",
      };

  const chipStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 14px",
        borderRadius: "20px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#fff",
        color: "#374151",
        fontSize: "13px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
      };

  return (
    <div
      className={cx("ai-suggestions", className)}
      data-testid={testId}
      role="list"
      style={{ ...containerStyle, ...style }}
    >
      {suggestions.map((suggestion) => {
        const handleClick = () =>
          onSelect(suggestion.prompt ?? suggestion.label);

        if (renderChip) {
          return (
            <React.Fragment key={suggestion.id}>
              {renderChip(suggestion, handleClick)}
            </React.Fragment>
          );
        }

        return (
          <button
            key={suggestion.id}
            onClick={handleClick}
            role="listitem"
            data-testid={`ai-suggestion-${suggestion.id}`}
            style={unstyled ? undefined : chipStyle}
            type="button"
          >
            {suggestion.icon && <span>{suggestion.icon}</span>}
            {suggestion.label}
          </button>
        );
      })}
    </div>
  );
}
