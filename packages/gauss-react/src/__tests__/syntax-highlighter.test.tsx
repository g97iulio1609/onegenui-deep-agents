import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyntaxHighlighter, createCodeBlockRenderer } from "../components/syntax-highlighter.js";

describe("SyntaxHighlighter", () => {
  it("should render code with language", () => {
    render(<SyntaxHighlighter code="const x = 1;" language="javascript" />);
    const code = screen.getByTestId("gauss-syntax-code");
    expect(code).toBeTruthy();
    expect(code.getAttribute("data-language")).toBe("javascript");
    expect(code.textContent).toContain("const x = 1;");
  });

  it("should highlight keywords for JavaScript", () => {
    render(<SyntaxHighlighter code="const foo = 1;" language="javascript" />);
    const code = screen.getByTestId("gauss-syntax-code");
    const spans = code.querySelectorAll("span[data-token-type='keyword']");
    const keywordTexts = Array.from(spans).map((s) => s.textContent);
    expect(keywordTexts).toContain("const");
  });

  it("should highlight strings", () => {
    render(<SyntaxHighlighter code='const s = "hello";' language="javascript" />);
    const code = screen.getByTestId("gauss-syntax-code");
    const spans = code.querySelectorAll("span[data-token-type='string']");
    const stringTexts = Array.from(spans).map((s) => s.textContent);
    expect(stringTexts.some((t) => t?.includes('"hello"'))).toBe(true);
  });

  it("should highlight comments", () => {
    render(<SyntaxHighlighter code="// this is a comment" language="javascript" />);
    const code = screen.getByTestId("gauss-syntax-code");
    const spans = code.querySelectorAll("span[data-token-type='comment']");
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0].textContent).toContain("// this is a comment");
  });

  it("should highlight numbers", () => {
    render(<SyntaxHighlighter code="let x = 42.5;" language="javascript" />);
    const code = screen.getByTestId("gauss-syntax-code");
    const spans = code.querySelectorAll("span[data-token-type='number']");
    const numberTexts = Array.from(spans).map((s) => s.textContent);
    expect(numberTexts).toContain("42.5");
  });

  it("should handle unknown language gracefully", () => {
    render(<SyntaxHighlighter code="some random text" language="brainfuck" />);
    const code = screen.getByTestId("gauss-syntax-code");
    expect(code.textContent).toBe("some random text");
  });

  it("should apply dark theme colors by default", () => {
    render(<SyntaxHighlighter code="const x = 1;" language="javascript" />);
    const pre = screen.getByTestId("gauss-syntax-pre");
    expect(pre.style.backgroundColor).toBe("rgb(40, 44, 52)"); // #282c34
  });

  it("should apply light theme colors", () => {
    render(<SyntaxHighlighter code="const x = 1;" language="javascript" theme="light" />);
    const pre = screen.getByTestId("gauss-syntax-pre");
    expect(pre.style.backgroundColor).toBe("rgb(250, 250, 250)"); // #fafafa
  });

  it("should highlight Python keywords", () => {
    render(<SyntaxHighlighter code="def hello():" language="python" />);
    const code = screen.getByTestId("gauss-syntax-code");
    const spans = code.querySelectorAll("span[data-token-type='keyword']");
    const keywordTexts = Array.from(spans).map((s) => s.textContent);
    expect(keywordTexts).toContain("def");
  });

  it("should highlight function calls", () => {
    render(<SyntaxHighlighter code="console.log(x)" language="javascript" />);
    const code = screen.getByTestId("gauss-syntax-code");
    const spans = code.querySelectorAll("span[data-token-type='function']");
    expect(spans.length).toBeGreaterThan(0);
  });
});

describe("createCodeBlockRenderer", () => {
  it("should return a function that produces valid ReactNode", () => {
    const renderer = createCodeBlockRenderer("dark");
    expect(typeof renderer).toBe("function");

    const node = renderer("const x = 1;", "javascript");
    const { container } = render(<>{node}</>);
    expect(container.querySelector("[data-testid='gauss-highlighted-code-block']")).toBeTruthy();
    expect(container.querySelector("[data-testid='gauss-syntax-code']")).toBeTruthy();
  });

  it("should include copy button in rendered code block", () => {
    const renderer = createCodeBlockRenderer();
    const node = renderer("hello()", "python");
    render(<>{node}</>);
    expect(screen.getByTestId("gauss-highlighted-copy-button")).toBeTruthy();
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("should use light theme when specified", () => {
    const renderer = createCodeBlockRenderer("light");
    const node = renderer("let x = 1;", "rust");
    render(<>{node}</>);
    const pre = screen.getByTestId("gauss-syntax-pre");
    expect(pre.style.backgroundColor).toBe("rgb(250, 250, 250)");
  });
});
