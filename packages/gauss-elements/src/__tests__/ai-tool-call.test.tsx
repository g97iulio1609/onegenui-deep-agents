import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIToolCall } from "../components/ai-tool-call.js";

describe("AIToolCall", () => {
  const defaultProps = {
    toolName: "get_weather",
    toolCallId: "call_abc123",
    args: { city: "Rome" },
  };

  it("renders tool name", () => {
    render(<AIToolCall {...defaultProps} />);
    expect(screen.getByText("get_weather")).toBeTruthy();
  });

  it("shows status indicator", () => {
    render(<AIToolCall {...defaultProps} status="running" />);
    const el = screen.getByTestId("ai-tool-call");
    expect(el.getAttribute("data-status")).toBe("running");
  });

  it("is collapsed by default", () => {
    render(<AIToolCall {...defaultProps} />);
    expect(screen.queryByTestId("ai-tool-call-body")).toBeNull();
  });

  it("expands when header is clicked", () => {
    render(<AIToolCall {...defaultProps} />);
    const header = screen.getByRole("button");
    fireEvent.click(header);

    expect(screen.getByTestId("ai-tool-call-body")).toBeTruthy();
    expect(screen.getByText(/"city": "Rome"/)).toBeTruthy();
  });

  it("starts expanded when defaultExpanded=true", () => {
    render(<AIToolCall {...defaultProps} defaultExpanded />);
    expect(screen.getByTestId("ai-tool-call-body")).toBeTruthy();
  });

  it("shows result when provided", () => {
    render(
      <AIToolCall
        {...defaultProps}
        result={{ temp: 25, unit: "C" }}
        defaultExpanded
      />,
    );
    expect(screen.getByTestId("ai-tool-call-result")).toBeTruthy();
    expect(screen.getByText(/"temp": 25/)).toBeTruthy();
  });

  it("shows string result directly", () => {
    render(
      <AIToolCall {...defaultProps} result="25°C" defaultExpanded />,
    );
    expect(screen.getByText("25°C")).toBeTruthy();
  });

  it("toggles with keyboard", () => {
    render(<AIToolCall {...defaultProps} />);
    const header = screen.getByRole("button");

    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.getByTestId("ai-tool-call-body")).toBeTruthy();

    fireEvent.keyDown(header, { key: " " });
    expect(screen.queryByTestId("ai-tool-call-body")).toBeNull();
  });

  it("renders unstyled", () => {
    render(<AIToolCall {...defaultProps} unstyled />);
    const el = screen.getByTestId("ai-tool-call");
    expect(el.style.border).toBe("");
  });

  it("supports custom status icon", () => {
    render(
      <AIToolCall
        {...defaultProps}
        status="success"
        renderStatusIcon={(s) => <span data-testid="custom-icon">{s}</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeTruthy();
  });
});
