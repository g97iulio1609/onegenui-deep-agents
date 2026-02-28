// =============================================================================
// ElevenLabsVoiceAdapter — Premium TTS via ElevenLabs API
// =============================================================================

import type {
  VoicePort,
  VoiceConfig,
  VoiceEventListener,
  VoiceEvent,
} from "../../../ports/voice.port.js";

export interface ElevenLabsVoiceOptions {
  apiKey: string;
  voiceId?: string;
  model?: string;
  baseUrl?: string;
}

export class ElevenLabsVoiceAdapter implements VoicePort {
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private listeners: VoiceEventListener[] = [];

  constructor(options: ElevenLabsVoiceOptions) {
    this.apiKey = options.apiKey;
    this.voiceId = options.voiceId ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel
    this.model = options.model ?? "eleven_multilingual_v2";
    this.baseUrl = options.baseUrl ?? "https://api.elevenlabs.io/v1";
  }

  async speak(text: string, _config?: VoiceConfig): Promise<Uint8Array> {
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${this.voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: this.model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs TTS failed: ${response.status} ${err}`);
    }

    this.emit({ type: "speaking", text });
    const buffer = await response.arrayBuffer();
    const audio = new Uint8Array(buffer);
    this.emit({ type: "audio", data: audio });
    return audio;
  }

  async listen(
    _audio: Uint8Array,
    _config?: VoiceConfig
  ): Promise<string> {
    throw new Error(
      "ElevenLabs does not support STT. Use OpenAIVoiceAdapter for STT."
    );
  }

  async connect(_config?: VoiceConfig): Promise<void> {
    this.emit({ type: "connected" });
  }

  async disconnect(): Promise<void> {
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
