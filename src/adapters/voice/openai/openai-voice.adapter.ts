// =============================================================================
// OpenAIVoiceAdapter — STT (Whisper) + TTS via OpenAI APIs
// =============================================================================

import type {
  VoicePort,
  VoiceConfig,
  VoiceEventListener,
  VoiceEvent,
} from "../../../ports/voice.port.js";

export interface OpenAIVoiceOptions {
  apiKey: string;
  sttModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
  baseUrl?: string;
}

export class OpenAIVoiceAdapter implements VoicePort {
  private readonly apiKey: string;
  private readonly sttModel: string;
  private readonly ttsModel: string;
  private readonly ttsVoice: string;
  private readonly baseUrl: string;
  private listeners: VoiceEventListener[] = [];
  private connected = false;

  constructor(options: OpenAIVoiceOptions) {
    this.apiKey = options.apiKey;
    this.sttModel = options.sttModel ?? "whisper-1";
    this.ttsModel = options.ttsModel ?? "tts-1";
    this.ttsVoice = options.ttsVoice ?? "alloy";
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  }

  async speak(text: string, config?: VoiceConfig): Promise<Uint8Array> {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config?.model ?? this.ttsModel,
        input: text,
        voice: this.ttsVoice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS failed: ${response.status} ${err}`);
    }

    this.emit({ type: "speaking", text });
    const buffer = await response.arrayBuffer();
    const audio = new Uint8Array(buffer);
    this.emit({ type: "audio", data: audio });
    return audio;
  }

  async listen(audio: Uint8Array, config?: VoiceConfig): Promise<string> {
    this.emit({ type: "listening" });

    const blob = new Blob([audio], { type: "audio/mp3" });
    const formData = new FormData();
    formData.append("file", blob, "audio.mp3");
    formData.append("model", config?.model ?? this.sttModel);
    if (config?.language) formData.append("language", config.language);

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI STT failed: ${response.status} ${err}`);
    }

    const data = (await response.json()) as { text: string };
    this.emit({ type: "transcript", text: data.text, isFinal: true });
    return data.text;
  }

  async connect(_config?: VoiceConfig): Promise<void> {
    this.connected = true;
    this.emit({ type: "connected" });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit({ type: "disconnected" });
  }

  on(listener: VoiceEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: VoiceEvent): void {
    for (const l of this.listeners) l(event);
  }
}
