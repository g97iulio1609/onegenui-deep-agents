import { useEffect, useRef } from "react";
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

  return (
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
  );
}
