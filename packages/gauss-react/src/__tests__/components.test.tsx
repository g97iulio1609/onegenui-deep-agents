import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AgentSelector,
  ChatInput,
  ChatPanel,
  MessageList,
  StreamingIndicator,
  ToolCallViewer,
} from "../components/index.js";
import type { ChatMessage, ToolCallPart, ToolResultPart } from "@gauss-ai/chat";

const userMessage: ChatMessage = {
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "Hello!" }],
};

const assistantMessage: ChatMessage = {
  id: "m2",
  role: "assistant",
  parts: [{ type: "text", text: "Hi there!" }],
};

const toolMessage: ChatMessage = {
  id: "m3",
  role: "assistant",
  parts: [
    { type: "text", text: "Let me search..." },
    { type: "tool-call", toolName: "search", toolCallId: "tc1", args: { q: "test" } },
  ],
};

describe("ChatInput", () => {
  it("should render textarea and send button", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByTestId("gauss-chat-textarea")).toBeTruthy();
    expect(screen.getByTestId("gauss-send-button")).toBeTruthy();
  });

  it("should call onSend with input text on submit", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("gauss-chat-textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByTestId("gauss-send-button"));

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("should submit on Enter key", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("gauss-chat-textarea");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("should not submit on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("gauss-chat-textarea");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not submit empty text", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    fireEvent.click(screen.getByTestId("gauss-send-button"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("should show stop button when streaming", () => {
    const onStop = vi.fn();
    render(<ChatInput onSend={vi.fn()} status="streaming" onStop={onStop} />);
    expect(screen.getByTestId("gauss-stop-button")).toBeTruthy();
  });

  it("should disable textarea when disabled prop is true", () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    const textarea = screen.getByTestId("gauss-chat-textarea") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("should clear input after send", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByTestId("gauss-chat-textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByTestId("gauss-send-button"));

    expect(textarea.value).toBe("");
  });
});

describe("StreamingIndicator", () => {
  it("should not render when not streaming", () => {
    render(<StreamingIndicator isStreaming={false} />);
    expect(screen.queryByTestId("gauss-streaming-indicator")).toBeNull();
  });

  it("should render when streaming", () => {
    render(<StreamingIndicator isStreaming={true} />);
    expect(screen.getByTestId("gauss-streaming-indicator")).toBeTruthy();
  });

  it("should display custom text", () => {
    render(<StreamingIndicator isStreaming={true} text="Generating" />);
    expect(screen.getByText("Generating")).toBeTruthy();
  });
});

describe("MessageList", () => {
  it("should render messages", () => {
    render(<MessageList messages={[userMessage, assistantMessage]} />);
    expect(screen.getByTestId("gauss-message-list")).toBeTruthy();
    expect(screen.getByText("Hello!")).toBeTruthy();
    expect(screen.getByText("Hi there!")).toBeTruthy();
  });

  it("should render empty list", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByTestId("gauss-message-list")).toBeTruthy();
  });

  it("should show tool calls in messages", () => {
    render(<MessageList messages={[toolMessage]} />);
    expect(screen.getByTestId("gauss-tool-calls")).toBeTruthy();
  });

  it("should use custom renderMessage", () => {
    const custom = (msg: ChatMessage) => <div data-testid="custom">{msg.id}</div>;
    render(<MessageList messages={[userMessage]} renderMessage={custom} />);
    expect(screen.getByTestId("custom")).toBeTruthy();
  });
});

describe("ToolCallViewer", () => {
  it("should render tool calls", () => {
    const toolCalls: ToolCallPart[] = [
      { type: "tool-call", toolName: "search", toolCallId: "tc1", args: { q: "test" } },
    ];
    render(<ToolCallViewer toolCalls={toolCalls} />);
    expect(screen.getByTestId("gauss-tool-call-viewer")).toBeTruthy();
    expect(screen.getByText(/search/)).toBeTruthy();
  });

  it("should render tool results when provided", () => {
    const toolCalls: ToolCallPart[] = [
      { type: "tool-call", toolName: "calc", toolCallId: "tc2", args: { x: 1 } },
    ];
    const toolResults: ToolResultPart[] = [
      { type: "tool-result", toolCallId: "tc2", result: { answer: 42 } },
    ];
    render(<ToolCallViewer toolCalls={toolCalls} toolResults={toolResults} />);
    expect(screen.getByTestId("gauss-tool-result")).toBeTruthy();
  });
});

describe("AgentSelector", () => {
  const agents = [
    { id: "a1", name: "Code Reviewer" },
    { id: "a2", name: "Assistant", description: "General purpose" },
  ];

  it("should render agents as options", () => {
    render(<AgentSelector agents={agents} onSelect={vi.fn()} />);
    const select = screen.getByTestId("gauss-agent-selector") as HTMLSelectElement;
    // 2 agents + 1 placeholder
    expect(select.options).toHaveLength(3);
  });

  it("should call onSelect when changed", () => {
    const onSelect = vi.fn();
    render(<AgentSelector agents={agents} onSelect={onSelect} selectedAgent="a1" />);
    const select = screen.getByTestId("gauss-agent-selector");
    fireEvent.change(select, { target: { value: "a2" } });
    expect(onSelect).toHaveBeenCalledWith("a2");
  });

  it("should show selected agent", () => {
    render(<AgentSelector agents={agents} onSelect={vi.fn()} selectedAgent="a1" />);
    const select = screen.getByTestId("gauss-agent-selector") as HTMLSelectElement;
    expect(select.value).toBe("a1");
  });
});

describe("ChatPanel", () => {
  it("should render message list, input, and streaming indicator", () => {
    render(
      <ChatPanel
        messages={[userMessage, assistantMessage]}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gauss-chat-panel")).toBeTruthy();
    expect(screen.getByTestId("gauss-message-list")).toBeTruthy();
    expect(screen.getByTestId("gauss-chat-input")).toBeTruthy();
  });

  it("should render header when provided", () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        header={<span>Chat Header</span>}
      />,
    );
    expect(screen.getByTestId("gauss-chat-header")).toBeTruthy();
    expect(screen.getByText("Chat Header")).toBeTruthy();
  });

  it("should show streaming indicator when streaming", () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        status="streaming"
      />,
    );
    expect(screen.getByTestId("gauss-streaming-indicator")).toBeTruthy();
  });

  it("should not show streaming indicator when idle", () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        status="idle"
      />,
    );
    expect(screen.queryByTestId("gauss-streaming-indicator")).toBeNull();
  });
});
