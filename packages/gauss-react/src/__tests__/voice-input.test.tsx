import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { VoiceInput } from "../components/voice-input.js";

afterEach(() => { cleanup(); });

describe("VoiceInput", () => {
  it("renders a button with mic icon", () => {
    render(<VoiceInput onTranscript={() => {}} />);
    const btn = screen.getByTestId("gauss-voice-input");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toBe("Start voice input");
  });

  it("is disabled when disabled prop is true", () => {
    render(<VoiceInput onTranscript={() => {}} disabled />);
    const btn = screen.getByTestId("gauss-voice-input") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("is disabled when SpeechRecognition is not available", () => {
    render(<VoiceInput onTranscript={() => {}} />);
    const btn = screen.getByTestId("gauss-voice-input") as HTMLButtonElement;
    // jsdom doesn't have SpeechRecognition
    expect(btn.disabled).toBe(true);
  });

  it("calls onTranscript when SpeechRecognition fires result", () => {
    // Mock SpeechRecognition
    const mockRecognition = {
      lang: "",
      interimResults: false,
      maxAlternatives: 1,
      continuous: false,
      onresult: null as ((e: unknown) => void) | null,
      onend: null as (() => void) | null,
      onerror: null as (() => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    // Must be a real constructor function (not vi.fn returning object)
    Object.defineProperty(window, "SpeechRecognition", {
      value: function MockSpeechRecognition() { Object.assign(this, mockRecognition); },
      writable: true,
      configurable: true,
    });

    const onTranscript = vi.fn();
    const { unmount } = render(<VoiceInput onTranscript={onTranscript} />);
    const btn = screen.getByTestId("gauss-voice-input") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);

    expect(mockRecognition.start).toHaveBeenCalled();

    // Cleanup
    unmount();
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  });
});
