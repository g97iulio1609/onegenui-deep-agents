import React, { useCallback, useRef, useState } from "react";

// Web Speech API type shims (not all TS libs include these)
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export interface VoiceInputProps {
  /** Called when speech transcription is available. */
  onTranscript: (text: string) => void;
  /** Language for speech recognition. Default: "en-US". */
  language?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Custom className. */
  className?: string;
}

/**
 * Voice input button using the Web Speech API (SpeechRecognition).
 * Falls back to a disabled state on unsupported browsers.
 */
export function VoiceInput({
  onTranscript,
  language = "en-US",
  disabled = false,
  className,
}: VoiceInputProps): React.JSX.Element {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startRecording = useCallback(() => {
    if (!isSupported || disabled) return;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!SpeechRecognitionCtor) return;

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isSupported, disabled, language, onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={disabled || !isSupported}
      data-testid="gauss-voice-input"
      aria-label={isRecording ? "Stop recording" : "Start voice input"}
      style={{
        ...buttonStyle,
        ...(isRecording ? recordingStyle : {}),
        ...(disabled || !isSupported ? disabledButtonStyle : {}),
      }}
    >
      {isRecording ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const buttonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  border: "1px solid #d1d5db",
  backgroundColor: "transparent",
  color: "#6b7280",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s ease",
  flexShrink: 0,
};

const recordingStyle: React.CSSProperties = {
  backgroundColor: "#fef2f2",
  borderColor: "#ef4444",
  color: "#ef4444",
};

const disabledButtonStyle: React.CSSProperties = {
  opacity: 0.4,
  cursor: "not-allowed",
};
