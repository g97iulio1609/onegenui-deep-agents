import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GaussChat } from "../components/gauss-chat.js";
import { GaussChatWindow } from "../components/gauss-chat-window.js";
import { darkTheme } from "../presets.js";

/* ── Mock useChat ─────────────────────────────────────────────────────────── */

const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockReset = vi.fn();

vi.mock("@gauss-ai/chat", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: mockSendMessage,
    status: "idle" as const,
    error: null,
    stop: mockStop,
    reset: mockReset,
    isLoading: false,
  })),
  getMessageText: vi.fn((msg: { parts: { type: string; text?: string }[] }) =>
    msg.parts
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text?: string }) => p.text ?? "")
      .join(""),
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── GaussChat ────────────────────────────────────────────────────────────── */

describe("GaussChat", () => {
  it("renders a chat panel", () => {
    render(<GaussChat api="/api/chat" />);
    expect(screen.getByTestId("gauss-chat")).toBeTruthy();
    expect(screen.getByTestId("gauss-chat-panel")).toBeTruthy();
  });

  it("renders with custom placeholder", () => {
    render(<GaussChat api="/api/chat" placeholder="Ask anything..." />);
    const textarea = screen.getByTestId("gauss-chat-textarea") as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe("Ask anything...");
  });

  it("renders with custom header", () => {
    render(<GaussChat api="/api/chat" header={<span data-testid="custom-header">My Bot</span>} />);
    expect(screen.getByTestId("custom-header")).toBeTruthy();
  });

  it("applies theme prop", () => {
    render(<GaussChat api="/api/chat" theme={darkTheme} />);
    expect(screen.getByTestId("gauss-chat-panel")).toBeTruthy();
  });

  it("sends a message via textarea", () => {
    render(<GaussChat api="/api/chat" />);
    const textarea = screen.getByTestId("gauss-chat-textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByTestId("gauss-send-button"));
    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });

  it("applies custom className and style", () => {
    render(<GaussChat api="/api/chat" className="my-chat" style={{ maxWidth: "600px" }} />);
    const root = screen.getByTestId("gauss-chat");
    expect(root.className).toContain("my-chat");
    expect(root.style.maxWidth).toBe("600px");
  });
});

/* ── GaussChatWindow ──────────────────────────────────────────────────────── */

describe("GaussChatWindow", () => {
  it("renders the toggle button", () => {
    render(<GaussChatWindow api="/api/chat" />);
    expect(screen.getByTestId("gauss-chat-window-toggle")).toBeTruthy();
  });

  it("starts closed by default", () => {
    render(<GaussChatWindow api="/api/chat" />);
    const panel = screen.getByTestId("gauss-chat-window-panel");
    expect(panel.style.display).toBe("none");
  });

  it("opens when toggle is clicked", () => {
    render(<GaussChatWindow api="/api/chat" />);
    fireEvent.click(screen.getByTestId("gauss-chat-window-toggle"));
    const panel = screen.getByTestId("gauss-chat-window-panel");
    expect(panel.style.display).toBe("flex");
  });

  it("starts open when defaultOpen is true", () => {
    render(<GaussChatWindow api="/api/chat" defaultOpen />);
    const panel = screen.getByTestId("gauss-chat-window-panel");
    expect(panel.style.display).toBe("flex");
  });

  it("closes when the close button is clicked", () => {
    render(<GaussChatWindow api="/api/chat" defaultOpen />);
    fireEvent.click(screen.getByTestId("gauss-chat-window-close"));
    const panel = screen.getByTestId("gauss-chat-window-panel");
    expect(panel.style.display).toBe("none");
  });

  it("displays custom title", () => {
    render(<GaussChatWindow api="/api/chat" defaultOpen title="Support" />);
    expect(screen.getByText("Support")).toBeTruthy();
  });

  it("supports custom renderToggle", () => {
    render(
      <GaussChatWindow
        api="/api/chat"
        renderToggle={(_isOpen, toggle) => (
          <button onClick={toggle} data-testid="custom-toggle">
            Chat
          </button>
        )}
      />,
    );
    expect(screen.getByTestId("custom-toggle")).toBeTruthy();
    expect(screen.queryByTestId("gauss-chat-window-toggle")).toBeNull();
  });

  it("applies theme to the floating window", () => {
    render(<GaussChatWindow api="/api/chat" theme={darkTheme} defaultOpen />);
    expect(screen.getByTestId("gauss-chat-window-panel")).toBeTruthy();
  });
});
