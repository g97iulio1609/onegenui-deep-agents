import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../App";

function mockFetch(url: string): Promise<Response> {
  if (url === "/api/agents" || (typeof url === "string" && url.includes("/api/agents") && !url.includes("/"))) {
    return Promise.resolve(new Response(JSON.stringify([
      { name: "assistant", description: "General-purpose AI assistant" },
      { name: "code-reviewer", description: "Reviews code" },
    ]), { headers: { "Content-Type": "application/json" } }));
  }
  if (url.includes("/tools")) {
    return Promise.resolve(new Response(JSON.stringify([
      { name: "web_search", description: "Search the web", parameters: {} },
    ]), { headers: { "Content-Type": "application/json" } }));
  }
  if (url.includes("/memory")) {
    return Promise.resolve(new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }));
  }
  if (url === "/api/chat") {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", text: "Hello " })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", text: "world!" })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return Promise.resolve(new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    }));
  }
  return Promise.resolve(new Response("Not found", { status: 404 }));
}

describe("Playground App", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch as typeof fetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the app header with Gauss branding", async () => {
    render(<App />);
    expect(screen.getByText(/gauss/i)).toBeInTheDocument();
  });

  it("loads and displays agents in the sidebar", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("assistant")).toBeInTheDocument();
    });
    expect(screen.getByText("code-reviewer")).toBeInTheDocument();
  });

  it("shows tab bar with all tabs including SDK Explorer", async () => {
    render(<App />);
    expect(screen.getByText("📦 SDK Explorer")).toBeInTheDocument();
    expect(screen.getByText("💬 Chat")).toBeInTheDocument();
    expect(screen.getByText("🔧 Tools")).toBeInTheDocument();
    expect(screen.getByText("🧠 Memory")).toBeInTheDocument();
    expect(screen.getByText("🕸 Graph")).toBeInTheDocument();
  });

  it("enables SDK Explorer tab without selecting an agent", async () => {
    render(<App />);
    const explorerTab = screen.getByText("📦 SDK Explorer");
    fireEvent.click(explorerTab);
    await waitFor(() => {
      expect(screen.getByText("📦 Features", { exact: false })).toBeInTheDocument();
    });
  });

  it("disables other tabs when no agent is selected", async () => {
    render(<App />);
    const chatTab = screen.getByText("💬 Chat");
    expect(chatTab).toBeDisabled();
  });

  it("enables all tabs when an agent is selected", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("assistant")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("assistant"));
    await waitFor(() => {
      const chatTab = screen.getByText("💬 Chat");
      expect(chatTab).not.toBeDisabled();
    });
  });

  it("shows chat panel when Chat tab is active and agent selected", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("assistant")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("assistant"));
    await waitFor(() => {
      expect(screen.getByTestId("gauss-chat-panel")).toBeInTheDocument();
    });
  });
});
