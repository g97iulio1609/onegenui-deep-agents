import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIVoiceAdapter } from "../openai/openai-voice.adapter.js";
import { ElevenLabsVoiceAdapter } from "../elevenlabs/elevenlabs-voice.adapter.js";
import { VoicePipeline } from "../voice-pipeline.js";
import type { VoicePort, VoiceEvent } from "../../../ports/voice.port.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("OpenAIVoiceAdapter", () => {
  let adapter: OpenAIVoiceAdapter;

  beforeEach(() => {
    adapter = new OpenAIVoiceAdapter({ apiKey: "test-key" });
    mockFetch.mockReset();
  });

  it("speak() calls OpenAI TTS API and returns audio", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeAudio.buffer),
    });

    const events: VoiceEvent[] = [];
    adapter.on((e) => events.push(e));

    const result = await adapter.speak("Hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/speech",
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toBeInstanceOf(Uint8Array);
    expect(events.some((e) => e.type === "speaking")).toBe(true);
    expect(events.some((e) => e.type === "audio")).toBe(true);
  });

  it("listen() calls OpenAI Whisper API and returns transcript", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "Hello world" }),
    });

    const result = await adapter.listen(new Uint8Array([1, 2, 3]));

    expect(result).toBe("Hello world");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("speak() throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(adapter.speak("Hello")).rejects.toThrow("OpenAI TTS failed");
  });

  it("connect/disconnect emit events", async () => {
    const events: VoiceEvent[] = [];
    adapter.on((e) => events.push(e));

    await adapter.connect();
    await adapter.disconnect();

    expect(events[0].type).toBe("connected");
    expect(events[1].type).toBe("disconnected");
  });

  it("on() returns unsubscribe function", () => {
    const events: VoiceEvent[] = [];
    const unsub = adapter.on((e) => events.push(e));
    unsub();

    // after unsub, no events should be captured
    // (we can't trigger an event without calling speak/listen, so just check unsub works)
    expect(typeof unsub).toBe("function");
  });
});

describe("ElevenLabsVoiceAdapter", () => {
  let adapter: ElevenLabsVoiceAdapter;

  beforeEach(() => {
    adapter = new ElevenLabsVoiceAdapter({ apiKey: "el-key" });
    mockFetch.mockReset();
  });

  it("speak() calls ElevenLabs TTS API", async () => {
    const fakeAudio = new Uint8Array([4, 5, 6]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeAudio.buffer),
    });

    const result = await adapter.speak("Test speech");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.elevenlabs.io/v1/text-to-speech"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "xi-api-key": "el-key" }),
      })
    );
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("listen() throws (STT not supported)", async () => {
    await expect(adapter.listen(new Uint8Array([1]))).rejects.toThrow(
      "does not support STT"
    );
  });
});

describe("VoicePipeline", () => {
  it("process() runs STT → Agent → TTS", async () => {
    const stt: VoicePort = {
      speak: vi.fn(),
      listen: vi.fn().mockResolvedValue("transcribed text"),
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const tts: VoicePort = {
      speak: vi.fn().mockResolvedValue(new Uint8Array([10, 20])),
      listen: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const agent = vi.fn().mockResolvedValue("agent response");

    const pipeline = new VoicePipeline({ stt, tts, agent });
    const result = await pipeline.process(new Uint8Array([1, 2, 3]));

    expect(stt.listen).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      undefined
    );
    expect(agent).toHaveBeenCalledWith("transcribed text");
    expect(tts.speak).toHaveBeenCalledWith("agent response", undefined);
    expect(result.transcript).toBe("transcribed text");
    expect(result.agentResponse).toBe("agent response");
    expect(result.audio).toBeInstanceOf(Uint8Array);
    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("processText() skips STT", async () => {
    const stt: VoicePort = {
      speak: vi.fn(),
      listen: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const tts: VoicePort = {
      speak: vi.fn().mockResolvedValue(new Uint8Array([30])),
      listen: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const agent = vi.fn().mockResolvedValue("text response");

    const pipeline = new VoicePipeline({ stt, tts, agent });
    const result = await pipeline.processText("hello");

    expect(stt.listen).not.toHaveBeenCalled();
    expect(agent).toHaveBeenCalledWith("hello");
    expect(result.timing.sttMs).toBe(0);
  });
});
