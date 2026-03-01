import { useEffect, useRef, useState, useCallback } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";

const THEME_CSS = `
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--pg-syn-comment); }
.token.punctuation { color: var(--pg-syn-punctuation); }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol { color: var(--pg-syn-property); }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin { color: var(--pg-syn-string); }
.token.operator, .token.entity, .token.url { color: var(--pg-syn-operator); }
.token.atrule, .token.attr-value, .token.keyword { color: var(--pg-syn-keyword); }
.token.function, .token.class-name { color: var(--pg-syn-function); }
.token.regex, .token.important, .token.variable { color: var(--pg-syn-variable); }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
`;

let themeInjected = false;

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "typescript" }: CodeBlockProps) {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!themeInjected) {
      const style = document.createElement("style");
      style.textContent = THEME_CSS;
      document.head.appendChild(style);
      themeInjected = true;
    }
  }, []);

  useEffect(() => {
    if (ref.current) {
      Prism.highlightElement(ref.current);
    }
  }, [code, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div
      className="pg-codeblock-wrapper"
      style={{ position: "relative" }}
    >
      <button
        onClick={handleCopy}
        className="pg-codeblock-copy"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: copied ? "rgba(var(--pg-success), 0.2)" : "var(--pg-copy-bg)",
          color: copied ? "var(--pg-success)" : "var(--pg-text-muted)",
          border: "1px solid var(--pg-copy-border)",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 12,
          cursor: "pointer",
          opacity: copied ? 1 : 0,
          transition: "opacity 0.2s, background 0.2s, color 0.2s",
          zIndex: 1,
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre style={{
        background: "var(--pg-code-bg)",
        borderRadius: 8,
        padding: 16,
        overflow: "auto",
        margin: 0,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <code ref={ref} className={`language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
