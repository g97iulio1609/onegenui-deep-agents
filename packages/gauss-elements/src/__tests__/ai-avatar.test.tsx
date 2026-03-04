import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AIAvatar } from "../components/ai-avatar.js";

describe("AIAvatar", () => {
  it("renders with default initials for user role", () => {
    render(<AIAvatar role="user" />);
    const avatar = screen.getByTestId("ai-avatar");
    expect(avatar).toBeTruthy();
    expect(avatar.textContent).toBe("U");
    expect(avatar.getAttribute("data-role")).toBe("user");
  });

  it("renders AI initials for assistant role", () => {
    render(<AIAvatar role="assistant" />);
    expect(screen.getByTestId("ai-avatar").textContent).toBe("AI");
  });

  it("renders image when src is provided", () => {
    render(<AIAvatar role="user" src="https://example.com/avatar.png" />);
    const img = screen.getByTestId("ai-avatar").querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://example.com/avatar.png");
  });

  it("renders custom fallback", () => {
    render(<AIAvatar role="user" fallback="🤖" />);
    expect(screen.getByTestId("ai-avatar").textContent).toBe("🤖");
  });

  it("applies custom size", () => {
    render(<AIAvatar role="user" size={48} />);
    const avatar = screen.getByTestId("ai-avatar");
    expect(avatar.style.width).toBe("48px");
    expect(avatar.style.height).toBe("48px");
  });

  it("renders unstyled when unstyled=true", () => {
    render(<AIAvatar role="user" unstyled />);
    const avatar = screen.getByTestId("ai-avatar");
    expect(avatar.style.width).toBe("");
  });

  it("applies custom className", () => {
    render(<AIAvatar role="user" className="custom-class" />);
    const avatar = screen.getByTestId("ai-avatar");
    expect(avatar.className).toContain("custom-class");
  });
});
