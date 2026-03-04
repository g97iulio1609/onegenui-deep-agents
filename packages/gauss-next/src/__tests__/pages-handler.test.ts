import { describe, it, expect, vi } from "vitest";
import { createGaussPagesRoute } from "../pages-handler.js";

function createMockReq(method = "POST", body: unknown = {}): {
  method: string;
  body: unknown;
} {
  return { method, body };
}

function createMockRes() {
  const chunks: Uint8Array[] = [];
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let ended = false;
  let jsonBody: unknown = null;

  const res = {
    writeHead: vi.fn((code: number, hdrs: Record<string, string>) => {
      statusCode = code;
      Object.assign(headers, hdrs);
    }),
    write: vi.fn((chunk: Uint8Array) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      ended = true;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    status: vi.fn(function (this: typeof res, code: number) {
      statusCode = code;
      return this;
    }),
    json: vi.fn((body: unknown) => {
      jsonBody = body;
    }),
    get statusCode() { return statusCode; },
    get headers() { return headers; },
    get ended() { return ended; },
    get chunks() { return chunks; },
    get jsonBody() { return jsonBody; },
  };

  return res;
}

describe("createGaussPagesRoute", () => {
  it("returns a function", () => {
    const handler = createGaussPagesRoute(async () => {});
    expect(typeof handler).toBe("function");
  });

  it("rejects non-POST methods", () => {
    const handler = createGaussPagesRoute(async () => {});
    const req = createMockReq("GET");
    const res = createMockRes();

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("rejects non-array messages", () => {
    const handler = createGaussPagesRoute(async () => {});
    const req = createMockReq("POST", { messages: "invalid" });
    const res = createMockRes();

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "messages must be an array" });
  });

  it("streams SSE response on valid request", async () => {
    const handler = createGaussPagesRoute(async (_messages, stream) => {
      stream.writeText("Hello");
      stream.close();
    });

    const messages = [{ id: "1", role: "user", content: "hi", parts: [] }];
    const req = createMockReq("POST", { messages });
    const res = createMockRes();

    handler(req, res);

    // Wait for streaming to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
    }));
    expect(res.end).toHaveBeenCalled();
    expect(res.chunks.length).toBeGreaterThan(0);
  });

  it("passes messages to handler", async () => {
    const streamHandler = vi.fn(async (_m, stream) => { stream.close(); });
    const handler = createGaussPagesRoute(streamHandler);

    const messages = [{ id: "1", role: "user", content: "test", parts: [] }];
    const req = createMockReq("POST", { messages });
    const res = createMockRes();

    handler(req, res);

    await new Promise((r) => setTimeout(r, 50));

    expect(streamHandler).toHaveBeenCalledOnce();
    expect(streamHandler.mock.calls[0][0]).toEqual(messages);
  });

  it("handles CORS preflight when cors is set", () => {
    const handler = createGaussPagesRoute(async () => {}, {
      cors: "https://example.com",
    });

    const req = createMockReq("OPTIONS");
    const res = createMockRes();

    handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
      "Access-Control-Allow-Origin": "https://example.com",
    }));
    expect(res.end).toHaveBeenCalled();
  });

  it("includes CORS headers in streaming response", async () => {
    const handler = createGaussPagesRoute(
      async (_m, stream) => { stream.close(); },
      { cors: "https://example.com" },
    );

    const req = createMockReq("POST", { messages: [] });
    const res = createMockRes();

    handler(req, res);

    await new Promise((r) => setTimeout(r, 50));

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Access-Control-Allow-Origin": "https://example.com",
    }));
  });

  it("calls onError when handler throws", async () => {
    const onError = vi.fn();
    const handler = createGaussPagesRoute(
      async () => { throw new Error("fail"); },
      { onError },
    );

    const req = createMockReq("POST", { messages: [] });
    const res = createMockRes();

    handler(req, res);

    await new Promise((r) => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledOnce();
  });

  it("defaults to empty messages when not provided", async () => {
    const streamHandler = vi.fn(async (_m, stream) => { stream.close(); });
    const handler = createGaussPagesRoute(streamHandler);

    const req = createMockReq("POST", {});
    const res = createMockRes();

    handler(req, res);

    await new Promise((r) => setTimeout(r, 50));

    expect(streamHandler.mock.calls[0][0]).toEqual([]);
  });
});
