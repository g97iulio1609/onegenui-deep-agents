import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AIMessage } from "../components/ai-message.js";

describe("AIMessage", () => {
  it("renders user message", () => {
    render(<AIMessage role="user">Hello</AIMessage>);
    const msg = screen.getByTestId("ai-message");
    expect(msg).toBeTruthy();
    expect(msg.getAttribute("data-role")).toBe("user");
    expect(msg.textContent).toContain("Hello");
  });

  it("renders assistant message", () => {
    render(<AIMessage role="assistant">Hi there</AIMessage>);
    const msg = screen.getByTestId("ai-message");
    expect(msg.getAttribute("data-role")).toBe("assistant");
  });

  it("shows name and timestamp when provided", () => {
    render(
      <AIMessage role="assistant" name="Gauss" timestamp="2:30 PM">
        Reply
      </AIMessage>,
    );
    expect(screen.getByText("Gauss")).toBeTruthy();
    expect(screen.getByText("2:30 PM")).toBeTruthy();
  });

  it("renders actions slot", () => {
    render(
      <AIMessage role="assistant" actions={<button>Copy</button>}>
        Content
      </AIMessage>,
    );
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("indicates streaming state", () => {
    render(
      <AIMessage role="assistant" isStreaming>
        Streaming...
      </AIMessage>,
    );
    const msg = screen.getByTestId("ai-message");
    expect(msg.getAttribute("data-streaming")).toBe("true");
  });

  it("renders with avatar image", () => {
    render(
      <AIMessage role="user" avatar="https://example.com/avatar.png">
        With avatar
      </AIMessage>,
    );
    const img = screen.getByTestId("ai-message").querySelector("img");
    expect(img).toBeTruthy();
  });

  it("supports custom avatar renderer", () => {
    render(
      <AIMessage role="assistant" renderAvatar={(role) => <span data-testid="custom-avatar">{role}</span>}>
        Custom
      </AIMessage>,
    );
    expect(screen.getByTestId("custom-avatar")).toBeTruthy();
  });

  it("renders unstyled", () => {
    render(
      <AIMessage role="user" unstyled>
        Unstyled
      </AIMessage>,
    );
    const msg = screen.getByTestId("ai-message");
    expect(msg.style.display).toBe("");
  });
});
