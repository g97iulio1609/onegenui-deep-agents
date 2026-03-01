import { useEffect, useRef, useState, useCallback } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";

const THEME_CSS = `
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6c7086; }
.token.punctuation { color: #9399b2; }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol { color: #fab387; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin { color: #a6e3a1; }
.token.operator, .token.entity, .token.url { color: #89dceb; }
.token.atrule, .token.attr-value, .token.keyword { color: #cba6f7; }
.token.function, .token.class-name { color: #89b4fa; }
.token.regex, .token.important, .token.variable { color: #f9e2af; }
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
          background: copied ? "rgba(166,227,161,0.2)" : "rgba(255,255,255,0.08)",
          color: copied ? "#a6e3a1" : "#9399b2",
          border: "1px solid rgba(255,255,255,0.1)",
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
        background: "#11111b",
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
