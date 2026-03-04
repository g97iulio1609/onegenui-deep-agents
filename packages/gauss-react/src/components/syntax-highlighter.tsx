import React, { useCallback, useMemo, useState } from "react";

export interface SyntaxHighlighterProps {
  code: string;
  language: string;
  theme?: "light" | "dark";
}

// ─── Token Types ─────────────────────────────────────────────────────────────

interface Token {
  type: "keyword" | "string" | "comment" | "number" | "function" | "default";
  value: string;
}

// ─── Color Schemes ───────────────────────────────────────────────────────────

const darkColors: Record<Token["type"], { color: string; fontStyle?: string }> = {
  keyword: { color: "#c678dd" },
  string: { color: "#98c379" },
  comment: { color: "#5c6370", fontStyle: "italic" },
  number: { color: "#d19a66" },
  function: { color: "#61afef" },
  default: { color: "#abb2bf" },
};

const lightColors: Record<Token["type"], { color: string; fontStyle?: string }> = {
  keyword: { color: "#a626a4" },
  string: { color: "#50a14f" },
  comment: { color: "#a0a1a7", fontStyle: "italic" },
  number: { color: "#986801" },
  function: { color: "#4078f2" },
  default: { color: "#383a42" },
};

// ─── Language Keywords ───────────────────────────────────────────────────────

const languageKeywords: Record<string, Set<string>> = {
  javascript: new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "class", "import", "export", "from", "async", "await", "try", "catch",
    "throw", "new", "typeof", "instanceof",
  ]),
  python: new Set([
    "def", "class", "import", "from", "return", "if", "elif", "else", "for",
    "while", "try", "except", "raise", "with", "as", "yield", "async", "await",
    "pass", "break", "continue", "lambda", "None", "True", "False",
  ]),
  rust: new Set([
    "fn", "let", "mut", "pub", "struct", "enum", "impl", "trait", "use", "mod",
    "self", "super", "crate", "match", "if", "else", "for", "while", "loop",
    "return", "async", "await", "where", "type",
  ]),
};

// TypeScript/JSX/TSX share JS keywords
languageKeywords.typescript = languageKeywords.javascript;
languageKeywords.js = languageKeywords.javascript;
languageKeywords.ts = languageKeywords.typescript;
languageKeywords.jsx = languageKeywords.javascript;
languageKeywords.tsx = languageKeywords.typescript;
languageKeywords.py = languageKeywords.python;
languageKeywords.rs = languageKeywords.rust;

function getKeywords(language: string): Set<string> {
  return languageKeywords[language.toLowerCase()] ?? new Set();
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

const TOKEN_PATTERN =
  /(\/\/[^\n]*|#[^\n]*)|(["'`])(?:(?!\2|\\).|\\.)*\2|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*)\s*(?=\()|(\b[a-zA-Z_]\w*\b)/g;

function tokenize(code: string, language: string): Token[] {
  const keywords = getKeywords(language);
  const tokens: Token[] = [];
  const pattern = new RegExp(TOKEN_PATTERN.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "default", value: code.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "comment", value: match[0] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "string", value: match[0] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: "number", value: match[0] });
    } else if (match[4] !== undefined) {
      tokens.push({
        type: keywords.has(match[4]) ? "keyword" : "function",
        value: match[0],
      });
    } else if (match[5] !== undefined) {
      tokens.push({
        type: keywords.has(match[5]) ? "keyword" : "default",
        value: match[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < code.length) {
    tokens.push({ type: "default", value: code.slice(lastIndex) });
  }

  return tokens;
}

// ─── SyntaxHighlighter Component ─────────────────────────────────────────────

/** Lightweight zero-dependency syntax highlighter using regex-based tokenization. */
export function SyntaxHighlighter({
  code,
  language,
  theme = "dark",
}: SyntaxHighlighterProps): React.JSX.Element {
  const colors = theme === "dark" ? darkColors : lightColors;

  const tokens = useMemo(() => tokenize(code, language), [code, language]);

  const bgColor = theme === "dark" ? "#282c34" : "#fafafa";
  const defaultColor = colors.default.color;

  return (
    <pre
      data-testid="gauss-syntax-pre"
      style={{
        margin: 0,
        padding: "12px",
        backgroundColor: bgColor,
        fontSize: "13px",
        fontFamily: "monospace",
        overflow: "auto",
        lineHeight: 1.5,
        color: defaultColor,
      }}
    >
      <code data-testid="gauss-syntax-code" data-language={language || undefined}>
        {tokens.map((token, i) => {
          const style = colors[token.type];
          return (
            <span
              key={i}
              data-token-type={token.type}
              style={{ color: style.color, fontStyle: style.fontStyle }}
            >
              {token.value}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

// ─── Code Block Renderer Factory ─────────────────────────────────────────────

/** Factory that creates a codeBlockRenderer prop compatible with MarkdownRenderer. */
export function createCodeBlockRenderer(
  theme?: "light" | "dark",
): (code: string, language: string) => React.ReactNode {
  const resolvedTheme = theme ?? "dark";

  return function HighlightedCodeBlock(code: string, language: string): React.ReactNode {
    return (
      <HighlightedCodeBlockComponent code={code} language={language} theme={resolvedTheme} />
    );
  };
}

function HighlightedCodeBlockComponent({
  code,
  language,
  theme,
}: {
  code: string;
  language: string;
  theme: "light" | "dark";
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div data-testid="gauss-highlighted-code-block" style={wrapperStyle}>
      <div style={headerStyle}>
        {language && (
          <span style={langLabelStyle}>{language}</span>
        )}
        <button
          onClick={handleCopy}
          data-testid="gauss-highlighted-copy-button"
          style={copyBtnStyle}
          type="button"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter code={code} language={language} theme={theme} />
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const wrapperStyle: React.CSSProperties = {
  margin: "12px 0",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 12px",
  backgroundColor: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "12px",
};

const langLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "lowercase",
};

const copyBtnStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: "12px",
  color: "#6b7280",
  padding: "2px 8px",
  borderRadius: "4px",
};
