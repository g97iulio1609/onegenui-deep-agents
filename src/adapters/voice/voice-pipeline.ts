// =============================================================================
// VoicePipeline — STT → Agent → TTS orchestration for voice agents
// =============================================================================

import type { VoicePort, VoiceConfig } from "../../ports/voice.port.js";

export interface VoicePipelineConfig {
  /** STT adapter (e.g. OpenAIVoiceAdapter) */
  stt: VoicePort;
  /** TTS adapter (e.g. ElevenLabsVoiceAdapter or OpenAIVoiceAdapter) */
  tts: VoicePort;
  /** Agent or function that processes text → text */
  agent: (input: string) => Promise<string>;
  /** Optional STT config */
  sttConfig?: VoiceConfig;
  /** Optional TTS config */
  ttsConfig?: VoiceConfig;
}

export interface VoicePipelineResult {
  /** Transcribed text from STT */
  transcript: string;
  /** Agent's text response */
  agentResponse: string;
  /** TTS audio output */
  audio: Uint8Array;
  /** Timing info */
  timing: {
    sttMs: number;
    agentMs: number;
    ttsMs: number;
    totalMs: number;
  };
}

export class VoicePipeline {
  private readonly config: VoicePipelineConfig;

  constructor(config: VoicePipelineConfig) {
    this.config = config;
  }

  /** Process audio input through STT → Agent → TTS pipeline */
  async process(audioInput: Uint8Array): Promise<VoicePipelineResult> {
    const totalStart = Date.now();

    // STT
    const sttStart = Date.now();
    const transcript = await this.config.stt.listen(
      audioInput,
      this.config.sttConfig
    );
    const sttMs = Date.now() - sttStart;

    // Agent
    const agentStart = Date.now();
    const agentResponse = await this.config.agent(transcript);
    const agentMs = Date.now() - agentStart;

    // TTS
    const ttsStart = Date.now();
    const audio = await this.config.tts.speak(
      agentResponse,
      this.config.ttsConfig
    );
    const ttsMs = Date.now() - ttsStart;

    return {
      transcript,
      agentResponse,
      audio,
      timing: {
        sttMs,
        agentMs,
        ttsMs,
        totalMs: Date.now() - totalStart,
      },
    };
  }

  /** Process text input (skip STT), still generates TTS audio */
  async processText(
    text: string
  ): Promise<Omit<VoicePipelineResult, "transcript"> & { transcript: string }> {
    const totalStart = Date.now();

    const agentStart = Date.now();
    const agentResponse = await this.config.agent(text);
    const agentMs = Date.now() - agentStart;

    const ttsStart = Date.now();
    const audio = await this.config.tts.speak(
      agentResponse,
      this.config.ttsConfig
    );
    const ttsMs = Date.now() - ttsStart;

    return {
      transcript: text,
      agentResponse,
      audio,
      timing: {
        sttMs: 0,
        agentMs,
        ttsMs,
        totalMs: Date.now() - totalStart,
      },
    };
  }
}
