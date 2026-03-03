import React, { useCallback, useState } from "react";

export interface MarkdownRendererProps {
  /** Markdown content to render. */
  content: string;
  /** Custom class name. */
  className?: string;
  /** Custom renderer for code blocks. */
  codeBlockRenderer?: (code: string, language: string) => React.ReactNode;
}

// ─── Block Types ─────────────────────────────────────────────────────────────

type Block =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "code-block"; code: string; language: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "blockquote"; content: string }
  | { type: "hr" };

// ─── Inline Parser ───────────────────────────────────────────────────────────

const INLINE_PATTERN =
  /(`[^`]+`)|\[([^\]]+)\]\(([^)]+)\)|(\*\*(.+?)\*\*)|(\*([^*]+?)\*)/g;

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, "g");
  let lastIndex = 0;
  let matchIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-i${matchIndex++}`;

    if (match[1]) {
      nodes.push(
        <code key={key} style={inlineCodeStyle}>
          {match[1].slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(
        <a key={key} href={match[3]} rel="noopener noreferrer">
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(<strong key={key}>{match[5]}</strong>);
    } else if (match[6]) {
      nodes.push(<em key={key}>{match[7]}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

// ─── Block Parser ────────────────────────────────────────────────────────────

function isBlockStart(line: string): boolean {
  return (
    line.startsWith("```") ||
    /^#{1,3}\s/.test(line) ||
    line.startsWith("> ") ||
    /^- /.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^---+\s*$/.test(line)
  );
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "code-block", code: codeLines.join("\n"), language });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Unordered list
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

// ─── CodeBlock Component ─────────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div data-testid="gauss-md-code-block" style={codeBlockWrapperStyle}>
      <div style={codeBlockHeaderStyle}>
        {language && <span style={codeBlockLangStyle}>{language}</span>}
        <button
          onClick={handleCopy}
          data-testid="gauss-md-copy-button"
          style={copyButtonStyle}
          type="button"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={codeBlockPreStyle}>
        <code data-language={language || undefined}>{code}</code>
      </pre>
    </div>
  );
}

// ─── MarkdownRenderer Component ──────────────────────────────────────────────

/** Lightweight dependency-free Markdown renderer that converts common Markdown to React elements. */
export function MarkdownRenderer({
  content,
  className,
  codeBlockRenderer,
}: MarkdownRendererProps): React.JSX.Element | null {
  if (!content.trim()) return null;

  const blocks = parseBlocks(content);

  return (
    <div className={className} data-testid="gauss-md-renderer">
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        switch (block.type) {
          case "heading": {
            const Tag = `h${block.level}` as "h1" | "h2" | "h3";
            return (
              <Tag key={key} style={headingStyles[block.level]} data-testid="gauss-md-heading">
                {parseInline(block.content, key)}
              </Tag>
            );
          }

          case "paragraph":
            return (
              <p key={key} style={paragraphStyle} data-testid="gauss-md-paragraph">
                {parseInline(block.content, key)}
              </p>
            );

          case "code-block":
            if (codeBlockRenderer) {
              return (
                <React.Fragment key={key}>
                  {codeBlockRenderer(block.code, block.language)}
                </React.Fragment>
              );
            }
            return <CodeBlock key={key} code={block.code} language={block.language} />;

          case "unordered-list":
            return (
              <ul key={key} style={listStyle} data-testid="gauss-md-list">
                {block.items.map((item, i) => (
                  <li key={`${key}-li-${i}`} style={listItemStyle}>
                    {parseInline(item, `${key}-li-${i}`)}
                  </li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol key={key} style={listStyle} data-testid="gauss-md-list">
                {block.items.map((item, i) => (
                  <li key={`${key}-li-${i}`} style={listItemStyle}>
                    {parseInline(item, `${key}-li-${i}`)}
                  </li>
                ))}
              </ol>
            );

          case "blockquote":
            return (
              <blockquote key={key} style={blockquoteStyle} data-testid="gauss-md-blockquote">
                {parseInline(block.content, key)}
              </blockquote>
            );

          case "hr":
            return <hr key={key} style={hrStyle} data-testid="gauss-md-hr" />;

          default:
            return null;
        }
      })}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const headingStyles: Record<number, React.CSSProperties> = {
  1: { fontSize: "1.5em", fontWeight: 700, margin: "16px 0 8px" },
  2: { fontSize: "1.25em", fontWeight: 600, margin: "14px 0 6px" },
  3: { fontSize: "1.1em", fontWeight: 600, margin: "12px 0 4px" },
};

const paragraphStyle: React.CSSProperties = {
  margin: "8px 0",
  lineHeight: 1.6,
};

const inlineCodeStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderRadius: "4px",
  padding: "2px 6px",
  fontSize: "0.9em",
  fontFamily: "monospace",
};

const codeBlockWrapperStyle: React.CSSProperties = {
  margin: "12px 0",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  overflow: "hidden",
};

const codeBlockHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 12px",
  backgroundColor: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "12px",
};

const codeBlockLangStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "lowercase",
};

const copyButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: "12px",
  color: "#6b7280",
  padding: "2px 8px",
  borderRadius: "4px",
};

const codeBlockPreStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px",
  backgroundColor: "#f9fafb",
  fontSize: "13px",
  fontFamily: "monospace",
  overflow: "auto",
  lineHeight: 1.5,
};

const listStyle: React.CSSProperties = {
  margin: "8px 0",
  paddingLeft: "24px",
};

const listItemStyle: React.CSSProperties = {
  marginBottom: "4px",
  lineHeight: 1.6,
};

const blockquoteStyle: React.CSSProperties = {
  margin: "8px 0",
  padding: "8px 16px",
  borderLeft: "4px solid #d1d5db",
  color: "#6b7280",
  fontStyle: "italic",
};

const hrStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #e5e7eb",
  margin: "16px 0",
};
