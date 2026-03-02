import { describe, expect, it, vi } from "vitest";
import { GaussStream, pipeTextStream, toNextResponse } from "../server.js";
import type { StreamEvent } from "../types/index.js";

describe("GaussStream", () => {
  it("should create a readable stream", () => {
    const stream = new GaussStream();
    expect(stream.readable).toBeInstanceOf(ReadableStream);
  });

  it("should write text delta events", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();

    // Start reading in background
    const readPromise = reader.read();

    // Write after a microtask to let the stream start
    await new Promise((r) => setTimeout(r, 0));
    stream.writeText("Hello");

    const { value } = await readPromise;
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"type":"text-delta"');
    expect(text).toContain('"text":"Hello"');
    expect(text).toMatch(/^data: /);

    reader.releaseLock();
  });

  it("should write tool call events", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();
    const readPromise = reader.read();

    await new Promise((r) => setTimeout(r, 0));
    stream.writeToolCall("search", "tc1", { query: "test" });

    const { value } = await readPromise;
    const text = new TextDecoder().decode(value);
    const parsed = JSON.parse(text.replace("data: ", "").trim()) as StreamEvent;
    expect(parsed).toEqual({
      type: "tool-call",
      toolName: "search",
      toolCallId: "tc1",
      args: { query: "test" },
    });

    reader.releaseLock();
  });

  it("should write tool result events", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();
    const readPromise = reader.read();

    await new Promise((r) => setTimeout(r, 0));
    stream.writeToolResult("tc1", { answer: 42 });

    const { value } = await readPromise;
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"type":"tool-result"');
    expect(text).toContain('"toolCallId":"tc1"');

    reader.releaseLock();
  });

  it("should close with finish event and [DONE]", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();

    await new Promise((r) => setTimeout(r, 0));
    stream.close("stop");

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    const fullText = chunks.join("");
    expect(fullText).toContain('"type":"finish"');
    expect(fullText).toContain("[DONE]");
  });

  it("should handle error and close stream", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();

    await new Promise((r) => setTimeout(r, 0));
    stream.error("Something went wrong");

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"type":"error"');
    expect(text).toContain("Something went wrong");
  });
});

describe("toNextResponse", () => {
  it("should return a Response with SSE headers", () => {
    const stream = new GaussStream();
    const response = toNextResponse(stream);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("should merge custom headers", () => {
    const stream = new GaussStream();
    const response = toNextResponse(stream, {
      headers: { "X-Custom": "test" },
    });

    expect(response.headers.get("X-Custom")).toBe("test");
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  });
});

describe("pipeTextStream", () => {
  it("should pipe text chunks into the stream", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();

    async function* textSource(): AsyncIterable<string> {
      yield "Hello";
      yield " World";
    }

    const pipePromise = pipeTextStream(textSource(), stream);

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    await pipePromise;

    const fullText = chunks.join("");
    expect(fullText).toContain("Hello");
    expect(fullText).toContain("World");
    expect(fullText).toContain("[DONE]");
  });

  it("should handle errors in the source", async () => {
    const stream = new GaussStream();
    const reader = stream.readable.getReader();

    async function* errorSource(): AsyncIterable<string> {
      yield "Start";
      throw new Error("Source failed");
    }

    const pipePromise = pipeTextStream(errorSource(), stream);

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    await pipePromise;

    const fullText = chunks.join("");
    expect(fullText).toContain("Start");
    expect(fullText).toContain("Source failed");
    expect(fullText).toContain('"type":"error"');
  });
});
