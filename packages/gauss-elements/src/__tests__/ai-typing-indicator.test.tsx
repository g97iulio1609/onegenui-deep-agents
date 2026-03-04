import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AITypingIndicator } from "../components/ai-typing-indicator.js";

describe("AITypingIndicator", () => {
  it("renders nothing when not active", () => {
    render(<AITypingIndicator isActive={false} />);
    expect(screen.queryByTestId("ai-typing-indicator")).toBeNull();
  });

  it("renders when active", () => {
    render(<AITypingIndicator isActive />);
    expect(screen.getByTestId("ai-typing-indicator")).toBeTruthy();
  });

  it("renders default 3 dots", () => {
    render(<AITypingIndicator isActive />);
    const dots = screen.getAllByTestId("ai-typing-dot");
    expect(dots.length).toBe(3);
  });

  it("renders custom number of dots", () => {
    render(<AITypingIndicator isActive dots={5} />);
    const dots = screen.getAllByTestId("ai-typing-dot");
    expect(dots.length).toBe(5);
  });

  it("renders label when provided", () => {
    render(<AITypingIndicator isActive label="Thinking" />);
    expect(screen.getByText("Thinking")).toBeTruthy();
  });

  it("has role=status for accessibility", () => {
    render(<AITypingIndicator isActive />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("applies custom dot size", () => {
    render(<AITypingIndicator isActive dotSize={10} />);
    const dot = screen.getAllByTestId("ai-typing-dot")[0];
    expect(dot.style.width).toBe("10px");
    expect(dot.style.height).toBe("10px");
  });

  it("renders unstyled", () => {
    render(<AITypingIndicator isActive unstyled />);
    const el = screen.getByTestId("ai-typing-indicator");
    expect(el.style.display).toBe("");
  });
});
