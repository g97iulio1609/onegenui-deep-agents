import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatSkeleton } from "../components/chat-skeleton.js";

describe("ChatSkeleton", () => {
  it("should render default 3 message rows and input", () => {
    render(<ChatSkeleton />);
    expect(screen.getByTestId("gauss-chat-skeleton")).toBeTruthy();
    expect(screen.getAllByTestId("gauss-message-skeleton")).toHaveLength(3);
    expect(screen.getByTestId("gauss-input-skeleton")).toBeTruthy();
  });

  it("should render custom number of rows", () => {
    render(<ChatSkeleton rows={5} />);
    expect(screen.getAllByTestId("gauss-message-skeleton")).toHaveLength(5);
  });

  it("should hide input when showInput is false", () => {
    render(<ChatSkeleton showInput={false} />);
    expect(screen.queryByTestId("gauss-input-skeleton")).toBeNull();
  });

  it("should accept custom styles", () => {
    render(<ChatSkeleton style={{ maxWidth: "500px" }} />);
    const el = screen.getByTestId("gauss-chat-skeleton");
    expect(el.style.maxWidth).toBe("500px");
  });
});
