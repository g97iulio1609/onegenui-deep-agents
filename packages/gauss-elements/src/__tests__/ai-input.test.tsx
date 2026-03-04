import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIInput } from "../components/ai-input.js";

describe("AIInput", () => {
  it("renders textarea and send button", () => {
    render(<AIInput onSend={() => {}} />);
    expect(screen.getByTestId("ai-input-textarea")).toBeTruthy();
    expect(screen.getByTestId("ai-input-send")).toBeTruthy();
  });

  it("calls onSend when send button is clicked", () => {
    const onSend = vi.fn();
    render(<AIInput onSend={onSend} />);

    const textarea = screen.getByTestId("ai-input-textarea");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByTestId("ai-input-send"));

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("calls onSend on Enter key", () => {
    const onSend = vi.fn();
    render(<AIInput onSend={onSend} />);

    const textarea = screen.getByTestId("ai-input-textarea");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<AIInput onSend={onSend} />);

    const textarea = screen.getByTestId("ai-input-textarea");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send empty messages", () => {
    const onSend = vi.fn();
    render(<AIInput onSend={onSend} />);

    fireEvent.click(screen.getByTestId("ai-input-send"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows stop button when streaming", () => {
    const onStop = vi.fn();
    render(<AIInput onSend={() => {}} isStreaming onStop={onStop} />);

    expect(screen.getByTestId("ai-input-stop")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ai-input-stop"));
    expect(onStop).toHaveBeenCalled();
  });

  it("disables textarea when disabled", () => {
    render(<AIInput onSend={() => {}} disabled />);
    const textarea = screen.getByTestId("ai-input-textarea") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("renders start and end slots", () => {
    render(
      <AIInput
        onSend={() => {}}
        startSlot={<span data-testid="start">📎</span>}
        endSlot={<span data-testid="end">🎤</span>}
      />,
    );
    expect(screen.getByTestId("start")).toBeTruthy();
    expect(screen.getByTestId("end")).toBeTruthy();
  });

  it("renders top slot", () => {
    render(
      <AIInput
        onSend={() => {}}
        topSlot={<div data-testid="top">Suggestions</div>}
      />,
    );
    expect(screen.getByTestId("top")).toBeTruthy();
  });

  it("supports controlled value", () => {
    const onChange = vi.fn();
    render(<AIInput onSend={() => {}} value="controlled" onChange={onChange} />);

    const textarea = screen.getByTestId("ai-input-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("controlled");
  });

  it("clears internal value after send", () => {
    render(<AIInput onSend={() => {}} />);

    const textarea = screen.getByTestId("ai-input-textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByTestId("ai-input-send"));

    expect(textarea.value).toBe("");
  });

  it("supports custom send button", () => {
    render(
      <AIInput
        onSend={() => {}}
        renderSend={({ onClick, disabled }) => (
          <button onClick={onClick} disabled={disabled} data-testid="custom-send">
            Send
          </button>
        )}
      />,
    );
    expect(screen.getByTestId("custom-send")).toBeTruthy();
  });
});
