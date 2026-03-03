import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "../components/index.js";

describe("MarkdownRenderer", () => {
  it("should return null for empty content", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  it("should return null for whitespace-only content", () => {
    const { container } = render(<MarkdownRenderer content="   " />);
    expect(container.firstChild).toBeNull();
  });

  it("should apply custom className", () => {
    render(<MarkdownRenderer content="Hello" className="custom-md" />);
    expect(screen.getByTestId("gauss-md-renderer").className).toBe("custom-md");
  });

  describe("Headings", () => {
    it("should render h1", () => {
      render(<MarkdownRenderer content="# Hello" />);
      const el = screen.getByTestId("gauss-md-heading");
      expect(el.tagName).toBe("H1");
      expect(el.textContent).toBe("Hello");
    });

    it("should render h2", () => {
      render(<MarkdownRenderer content="## World" />);
      const el = screen.getByTestId("gauss-md-heading");
      expect(el.tagName).toBe("H2");
      expect(el.textContent).toBe("World");
    });

    it("should render h3", () => {
      render(<MarkdownRenderer content="### Test" />);
      const el = screen.getByTestId("gauss-md-heading");
      expect(el.tagName).toBe("H3");
      expect(el.textContent).toBe("Test");
    });
  });

  describe("Inline formatting", () => {
    it("should render bold text", () => {
      render(<MarkdownRenderer content="This is **bold** text" />);
      const strong = screen.getByText("bold");
      expect(strong.tagName).toBe("STRONG");
    });

    it("should render italic text", () => {
      render(<MarkdownRenderer content="This is *italic* text" />);
      const em = screen.getByText("italic");
      expect(em.tagName).toBe("EM");
    });

    it("should render inline code", () => {
      render(<MarkdownRenderer content="Use `console.log` here" />);
      const code = screen.getByText("console.log");
      expect(code.tagName).toBe("CODE");
    });
  });

  describe("Code blocks", () => {
    it("should render code block with language label", () => {
      const content = "```typescript\nconst x = 1;\n```";
      render(<MarkdownRenderer content={content} />);
      expect(screen.getByTestId("gauss-md-code-block")).toBeTruthy();
      expect(screen.getByText("typescript")).toBeTruthy();
      expect(screen.getByText("const x = 1;")).toBeTruthy();
    });

    it("should set data-language attribute on code element", () => {
      const content = "```js\nalert('hi');\n```";
      render(<MarkdownRenderer content={content} />);
      const code = screen.getByText("alert('hi');");
      expect(code.getAttribute("data-language")).toBe("js");
    });

    it("should render copy button", () => {
      const content = "```\ncode here\n```";
      render(<MarkdownRenderer content={content} />);
      expect(screen.getByTestId("gauss-md-copy-button")).toBeTruthy();
      expect(screen.getByText("Copy")).toBeTruthy();
    });

    it("should call clipboard on copy button click", () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const content = "```\nmy code\n```";
      render(<MarkdownRenderer content={content} />);
      fireEvent.click(screen.getByTestId("gauss-md-copy-button"));
      expect(writeText).toHaveBeenCalledWith("my code");
    });
  });

  describe("Links", () => {
    it("should render links with correct href", () => {
      render(<MarkdownRenderer content="Click [here](https://example.com)" />);
      const link = screen.getByText("here") as HTMLAnchorElement;
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toBe("https://example.com");
    });

    it("should set rel attribute on links", () => {
      render(<MarkdownRenderer content="[link](https://test.com)" />);
      const link = screen.getByText("link");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  describe("Lists", () => {
    it("should render unordered list", () => {
      const content = "- First\n- Second\n- Third";
      render(<MarkdownRenderer content={content} />);
      const list = screen.getByTestId("gauss-md-list");
      expect(list.tagName).toBe("UL");
      expect(screen.getByText("First")).toBeTruthy();
      expect(screen.getByText("Second")).toBeTruthy();
      expect(screen.getByText("Third")).toBeTruthy();
    });

    it("should render ordered list", () => {
      const content = "1. Alpha\n2. Beta\n3. Gamma";
      render(<MarkdownRenderer content={content} />);
      const list = screen.getByTestId("gauss-md-list");
      expect(list.tagName).toBe("OL");
      expect(screen.getByText("Alpha")).toBeTruthy();
      expect(screen.getByText("Beta")).toBeTruthy();
      expect(screen.getByText("Gamma")).toBeTruthy();
    });
  });

  describe("Blockquotes", () => {
    it("should render blockquote", () => {
      render(<MarkdownRenderer content="> This is a quote" />);
      const bq = screen.getByTestId("gauss-md-blockquote");
      expect(bq.tagName).toBe("BLOCKQUOTE");
      expect(bq.textContent).toBe("This is a quote");
    });
  });

  describe("Horizontal rules", () => {
    it("should render hr from ---", () => {
      render(<MarkdownRenderer content="---" />);
      expect(screen.getByTestId("gauss-md-hr")).toBeTruthy();
      expect(screen.getByTestId("gauss-md-hr").tagName).toBe("HR");
    });
  });

  describe("Paragraphs", () => {
    it("should render paragraphs", () => {
      render(<MarkdownRenderer content="Hello world" />);
      const p = screen.getByTestId("gauss-md-paragraph");
      expect(p.tagName).toBe("P");
      expect(p.textContent).toBe("Hello world");
    });

    it("should separate paragraphs by blank lines", () => {
      const content = "First paragraph\n\nSecond paragraph";
      render(<MarkdownRenderer content={content} />);
      const paragraphs = screen.getAllByTestId("gauss-md-paragraph");
      expect(paragraphs).toHaveLength(2);
    });
  });

  describe("Custom codeBlockRenderer", () => {
    it("should use custom renderer when provided", () => {
      const customRenderer = (code: string, language: string) => (
        <div data-testid="custom-code">
          {code} ({language})
        </div>
      );
      const content = "```python\nprint('hello')\n```";
      render(<MarkdownRenderer content={content} codeBlockRenderer={customRenderer} />);
      expect(screen.getByTestId("custom-code")).toBeTruthy();
      expect(screen.queryByTestId("gauss-md-code-block")).toBeNull();
    });
  });
});
