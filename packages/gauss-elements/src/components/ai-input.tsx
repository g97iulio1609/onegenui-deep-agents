/**
 * AIInput — Enhanced chat input with auto-resize and composable slots.
 *
 * Supports file attachment, voice input, and suggested prompts via render slots.
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import type { ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";

export interface AIInputProps extends ElementBaseProps {
  /** Callback when user submits a message. */
  onSend: (text: string) => void;
  /** Current value (controlled mode). */
  value?: string;
  /** onChange handler (controlled mode). */
  onChange?: (value: string) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Whether currently streaming (shows stop instead of send). */
  isStreaming?: boolean;
  /** Stop streaming callback. */
  onStop?: () => void;
  /** Maximum rows for auto-resize. Default: 6. */
  maxRows?: number;
  /** Slot: render before the textarea (e.g., file attach button). */
  startSlot?: React.ReactNode;
  /** Slot: render after send button (e.g., voice button). */
  endSlot?: React.ReactNode;
  /** Slot: render above input (e.g., suggested prompts, file preview). */
  topSlot?: React.ReactNode;
  /** Custom send button renderer. */
  renderSend?: (props: { onClick: () => void; disabled: boolean }) => React.ReactNode;
  /** Custom stop button renderer. */
  renderStop?: (props: { onClick: () => void }) => React.ReactNode;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

export function AIInput({
  onSend,
  value: controlledValue,
  onChange: controlledOnChange,
  placeholder = "Type a message...",
  disabled = false,
  isStreaming = false,
  onStop,
  maxRows = 6,
  startSlot,
  endSlot,
  topSlot,
  renderSend,
  renderStop,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-input",
}: AIInputProps): React.JSX.Element {
  const [internalValue, setInternalValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const value = controlledValue ?? internalValue;
  const setValue = controlledOnChange ?? setInternalValue;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const maxHeight = lineHeight * maxRows;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value, maxRows]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }, [value, isStreaming, disabled, onSend, setValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const containerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px 16px",
        borderTop: "1px solid #e5e7eb",
        backgroundColor: "#fff",
      };

  const rowStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        alignItems: "flex-end",
        gap: "8px",
      };

  const textareaStyle: React.CSSProperties = unstyled
    ? {}
    : {
        flex: 1,
        resize: "none",
        border: "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "10px 14px",
        fontSize: "14px",
        lineHeight: "20px",
        outline: "none",
        fontFamily: "inherit",
        transition: "border-color 0.15s",
        overflow: "auto",
      };

  const sendBtnStyle: React.CSSProperties = {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#6366f1",
    color: "#fff",
    cursor: "pointer",
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s",
  };

  const stopBtnStyle: React.CSSProperties = {
    ...sendBtnStyle,
    backgroundColor: "#ef4444",
  };

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div
      className={cx("ai-input", className)}
      data-testid={testId}
      style={{ ...containerStyle, ...style }}
    >
      {topSlot && <div className="ai-input__top">{topSlot}</div>}
      <div style={rowStyle}>
        {startSlot && <div className="ai-input__start">{startSlot}</div>}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          data-testid="ai-input-textarea"
          style={unstyled ? undefined : textareaStyle}
        />
        {isStreaming && onStop ? (
          renderStop ? (
            renderStop({ onClick: onStop })
          ) : (
            <button
              onClick={onStop}
              data-testid="ai-input-stop"
              style={unstyled ? undefined : stopBtnStyle}
              type="button"
              aria-label="Stop generating"
            >
              ■
            </button>
          )
        ) : renderSend ? (
          renderSend({ onClick: handleSubmit, disabled: !canSend })
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            data-testid="ai-input-send"
            style={unstyled ? undefined : { ...sendBtnStyle, opacity: canSend ? 1 : 0.4 }}
            type="button"
            aria-label="Send message"
          >
            ↑
          </button>
        )}
        {endSlot && <div className="ai-input__end">{endSlot}</div>}
      </div>
    </div>
  );
}
