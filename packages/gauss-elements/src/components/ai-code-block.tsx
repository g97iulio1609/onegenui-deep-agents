/**
 * AICodeBlock — Syntax-highlighted code block with copy button.
 */

import React, { useCallback, useState } from "react";
import type { ElementBaseProps } from "../types.js";
import { cx } from "../utils.js";

export interface AICodeBlockProps extends ElementBaseProps {
  /** The code content. */
  code: string;
  /** Programming language identifier. */
  language?: string;
  /** Show line numbers. Default: false. */
  showLineNumbers?: boolean;
  /** Show copy button. Default: true. */
  showCopy?: boolean;
  /** Show language badge. Default: true. */
  showLanguage?: boolean;
  /** Custom copy handler (overrides clipboard API). */
  onCopy?: (code: string) => void;
  /** Custom syntax highlighter render function. */
  renderHighlighted?: (code: string, language: string) => React.ReactNode;
  /** Whether to use unstyled/headless mode. */
  unstyled?: boolean;
}

export function AICodeBlock({
  code,
  language = "text",
  showLineNumbers = false,
  showCopy = true,
  showLanguage = true,
  onCopy,
  renderHighlighted,
  unstyled = false,
  className,
  style,
  "data-testid": testId = "ai-code-block",
}: AICodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (onCopy) {
      onCopy(code);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code, onCopy]);

  const containerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#1e1e2e",
        fontSize: "13px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
      };

  const headerStyle: React.CSSProperties = unstyled
    ? {}
    : {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 12px",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      };

  const codeStyle: React.CSSProperties = unstyled
    ? {}
    : {
        margin: 0,
        padding: "12px 16px",
        overflow: "auto",
        color: "#e2e8f0",
        lineHeight: 1.6,
        whiteSpace: "pre",
        tabSize: 2,
      };

  const copyBtnStyle: React.CSSProperties = unstyled
    ? {}
    : {
        background: "none",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "4px",
        color: "#a0a0b0",
        cursor: "pointer",
        fontSize: "11px",
        padding: "2px 8px",
        transition: "color 0.15s, border-color 0.15s",
      };

  const lines = code.split("\n");

  return (
    <div
      className={cx("ai-code-block", className)}
      data-testid={testId}
      data-language={language}
      style={{ ...containerStyle, ...style }}
    >
      {(showLanguage || showCopy) && (
        <div style={headerStyle}>
          {showLanguage ? (
            <span style={{ color: "#a0a0b0", fontSize: "11px", textTransform: "uppercase" }}>
              {language}
            </span>
          ) : (
            <span />
          )}
          {showCopy && (
            <button
              onClick={handleCopy}
              data-testid="ai-code-copy"
              style={unstyled ? undefined : copyBtnStyle}
              type="button"
              aria-label="Copy code"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      <pre style={codeStyle}>
        {renderHighlighted ? (
          renderHighlighted(code, language)
        ) : showLineNumbers ? (
          lines.map((line, i) => (
            <div key={i} style={{ display: "flex" }}>
              <span
                style={{
                  width: "3ch",
                  textAlign: "right",
                  color: "rgba(255,255,255,0.2)",
                  marginRight: "16px",
                  userSelect: "none",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span>{line}</span>
            </div>
          ))
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
