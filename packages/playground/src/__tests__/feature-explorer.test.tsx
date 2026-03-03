import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeatureExplorer } from "../components/FeatureExplorer";

function mockFetch(): Promise<Response> {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", text: "Demo " })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", text: "response" })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return Promise.resolve(new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  }));
}

describe("FeatureExplorer", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch as typeof fetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the features sidebar", () => {
    render(<FeatureExplorer />);
    expect(screen.getByText("Features", { exact: false })).toBeInTheDocument();
  });

  it("shows all 9 feature options", () => {
    render(<FeatureExplorer />);
    const buttons = screen.getAllByRole("button");
    const featureLabels = [
      "useChat Hook", "useCompletion Hook", "useAgent Hook",
      "<ChatPanel />", "<ChatInput />", "<ToolCallViewer />",
      "<AgentSelector />", "<StreamingIndicator />", "Theming System",
    ];
    for (const label of featureLabels) {
      expect(buttons.some(b => b.textContent?.includes(label))).toBe(true);
    }
  });

  it("defaults to useChat demo", () => {
    render(<FeatureExplorer />);
    // The header bar shows the selected feature name
    const headerText = screen.getAllByText("useChat Hook");
    expect(headerText.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("from @gauss-ai/chat").length).toBeGreaterThanOrEqual(1);
  });

  it("switches to useCompletion demo when clicked", () => {
    render(<FeatureExplorer />);
    fireEvent.click(screen.getByText("useCompletion Hook"));
    expect(screen.getByText("from @gauss-ai/chat")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter a prompt...")).toBeInTheDocument();
  });

  it("shows ToolCallViewer demo with sample data", () => {
    render(<FeatureExplorer />);
    fireEvent.click(screen.getByText("<ToolCallViewer />"));
    expect(screen.getByText("from @gauss-ai/react")).toBeInTheDocument();
  });

  it("shows AgentSelector demo with agents", () => {
    render(<FeatureExplorer />);
    fireEvent.click(screen.getByText("<AgentSelector />"));
    expect(screen.getByText("from @gauss-ai/react")).toBeInTheDocument();
  });

  it("shows StreamingIndicator demo with toggle", () => {
    render(<FeatureExplorer />);
    fireEvent.click(screen.getByText("<StreamingIndicator />"));
    expect(screen.getByText("Stop Streaming")).toBeInTheDocument();
  });

  it("shows Theming demo with color picker", () => {
    render(<FeatureExplorer />);
    fireEvent.click(screen.getByText("Theming System"));
    expect(screen.getByText("Primary Color:")).toBeInTheDocument();
  });

  it("shows ChatInput demo and captures sent text", () => {
    render(<FeatureExplorer />);
    fireEvent.click(screen.getByText("<ChatInput />"));
    const input = screen.getByPlaceholderText("Try typing and pressing Enter...");
    fireEvent.change(input, { target: { value: "test message" } });
    fireEvent.keyDown(input, { key: "Enter" });
  });
});
