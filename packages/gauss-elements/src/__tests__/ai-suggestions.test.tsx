import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AISuggestions } from "../components/ai-suggestions.js";

const suggestions = [
  { id: "1", label: "Tell me a joke" },
  { id: "2", label: "Write code", prompt: "Write a sorting algorithm" },
  { id: "3", label: "Explain", icon: "📚" },
];

describe("AISuggestions", () => {
  it("renders all suggestions", () => {
    render(<AISuggestions suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getByText("Tell me a joke")).toBeTruthy();
    expect(screen.getByText("Write code")).toBeTruthy();
    expect(screen.getByText("📚")).toBeTruthy();
  });

  it("calls onSelect with label when clicked", () => {
    const onSelect = vi.fn();
    render(<AISuggestions suggestions={suggestions} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Tell me a joke"));
    expect(onSelect).toHaveBeenCalledWith("Tell me a joke");
  });

  it("calls onSelect with prompt when available", () => {
    const onSelect = vi.fn();
    render(<AISuggestions suggestions={suggestions} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Write code"));
    expect(onSelect).toHaveBeenCalledWith("Write a sorting algorithm");
  });

  it("renders in vertical orientation", () => {
    render(
      <AISuggestions
        suggestions={suggestions}
        onSelect={() => {}}
        orientation="vertical"
      />,
    );
    const container = screen.getByTestId("ai-suggestions");
    expect(container.style.flexDirection).toBe("column");
  });

  it("renders with custom chip renderer", () => {
    render(
      <AISuggestions
        suggestions={[{ id: "1", label: "Test" }]}
        onSelect={() => {}}
        renderChip={(s, onClick) => (
          <div key={s.id} data-testid="custom-chip" onClick={onClick}>
            {s.label}
          </div>
        )}
      />,
    );
    expect(screen.getByTestId("custom-chip")).toBeTruthy();
  });

  it("renders unstyled", () => {
    render(
      <AISuggestions suggestions={suggestions} onSelect={() => {}} unstyled />,
    );
    const container = screen.getByTestId("ai-suggestions");
    expect(container.style.display).toBe("");
  });

  it("renders icon when provided", () => {
    render(
      <AISuggestions
        suggestions={[{ id: "1", label: "Help", icon: "🆘" }]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("🆘")).toBeTruthy();
  });
});
