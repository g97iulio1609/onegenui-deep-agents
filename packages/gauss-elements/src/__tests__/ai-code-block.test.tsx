import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AICodeBlock } from "../components/ai-code-block.js";

describe("AICodeBlock", () => {
  it("renders code content", () => {
    render(<AICodeBlock code='console.log("hello")' language="javascript" />);
    expect(screen.getByText('console.log("hello")')).toBeTruthy();
  });

  it("shows language badge", () => {
    render(<AICodeBlock code="x = 1" language="python" />);
    expect(screen.getByText("python")).toBeTruthy();
  });

  it("shows copy button", () => {
    render(<AICodeBlock code="test" />);
    expect(screen.getByTestId("ai-code-copy")).toBeTruthy();
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("copies code on click", async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<AICodeBlock code="test code" />);
    fireEvent.click(screen.getByTestId("ai-code-copy"));

    expect(mockClipboard.writeText).toHaveBeenCalledWith("test code");
  });

  it("shows Copied after click", async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<AICodeBlock code="test" />);
    fireEvent.click(screen.getByTestId("ai-code-copy"));

    // Wait for state update
    await vi.waitFor(() => {
      expect(screen.getByText("✓ Copied")).toBeTruthy();
    });
  });

  it("uses custom onCopy handler", () => {
    const onCopy = vi.fn();
    render(<AICodeBlock code="test" onCopy={onCopy} />);
    fireEvent.click(screen.getByTestId("ai-code-copy"));

    expect(onCopy).toHaveBeenCalledWith("test");
  });

  it("hides copy button when showCopy=false", () => {
    render(<AICodeBlock code="test" showCopy={false} />);
    expect(screen.queryByTestId("ai-code-copy")).toBeNull();
  });

  it("hides language when showLanguage=false", () => {
    render(<AICodeBlock code="test" language="js" showLanguage={false} />);
    expect(screen.queryByText("js")).toBeNull();
  });

  it("shows line numbers when enabled", () => {
    render(<AICodeBlock code={"line1\nline2\nline3"} showLineNumbers />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("sets data-language attribute", () => {
    render(<AICodeBlock code="test" language="rust" />);
    expect(screen.getByTestId("ai-code-block").getAttribute("data-language")).toBe("rust");
  });

  it("supports custom highlighter", () => {
    render(
      <AICodeBlock
        code="test"
        language="ts"
        renderHighlighted={(code, lang) => (
          <span data-testid="custom-highlight">
            {lang}:{code}
          </span>
        )}
      />,
    );
    expect(screen.getByTestId("custom-highlight")).toBeTruthy();
  });

  it("renders unstyled", () => {
    render(<AICodeBlock code="test" unstyled />);
    const el = screen.getByTestId("ai-code-block");
    expect(el.style.borderRadius).toBe("");
  });
});
