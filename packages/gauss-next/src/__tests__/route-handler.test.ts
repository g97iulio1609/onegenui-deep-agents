import { describe, it, expect, vi } from "vitest";
import { createGaussRoute } from "../route-handler.js";

describe("createGaussRoute", () => {
  function makeRequest(body: unknown): Request {
    return new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns an object with POST method", () => {
    const route = createGaussRoute(async () => {});
    expect(route).toHaveProperty("POST");
    expect(typeof route.POST).toBe("function");
  });

  it("streams text via SSE", async () => {
    const route = createGaussRoute(async (_messages, stream) => {
      stream.writeText("Hello");
      stream.writeText(" world");
      stream.close();
    });

    const request = makeRequest({ messages: [{ id: "1", role: "user", content: "hi", parts: [] }] });
    const response = await route.POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await response.text();
    expect(text).toContain("text-delta");
    expect(text).toContain("Hello");
    expect(text).toContain("world");
    expect(text).toContain("[DONE]");
  });

  it("returns 400 for invalid JSON", async () => {
    const route = createGaussRoute(async () => {});
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: "not json",
    });

    const response = await route.POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 for non-array messages", async () => {
    const route = createGaussRoute(async () => {});
    const request = makeRequest({ messages: "not an array" });

    const response = await route.POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("messages must be an array");
  });

  it("passes messages and context to handler", async () => {
    const handler = vi.fn(async (_messages, stream) => {
      stream.close();
    });

    const route = createGaussRoute(handler);
    const messages = [{ id: "1", role: "user", content: "test", parts: [] }];
    const request = makeRequest({ messages });

    await route.POST(request);

    // Wait for handler to be called
    await new Promise((r) => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual(messages);
    expect(handler.mock.calls[0][2]).toHaveProperty("body");
    expect(handler.mock.calls[0][2]).toHaveProperty("request");
  });

  it("handles handler errors gracefully", async () => {
    const onError = vi.fn();
    const route = createGaussRoute(
      async () => {
        throw new Error("Handler failed");
      },
      { onError },
    );

    const request = makeRequest({ messages: [] });
    const response = await route.POST(request);

    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toContain("Handler failed");

    await new Promise((r) => setTimeout(r, 10));
    expect(onError).toHaveBeenCalledOnce();
  });

  it("includes CORS headers when cors option is set", async () => {
    const route = createGaussRoute(
      async (_m, stream) => { stream.close(); },
      { cors: "https://example.com" },
    );

    const request = makeRequest({ messages: [] });
    const response = await route.POST(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com",
    );
  });

  it("returns OPTIONS handler when cors is set", () => {
    const route = createGaussRoute(async () => {}, {
      cors: "https://example.com",
    });

    expect(route.OPTIONS).toBeDefined();

    const response = route.OPTIONS!(
      new Request("http://localhost/api/chat", { method: "OPTIONS" }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com",
    );
  });

  it("does not return OPTIONS handler without cors", () => {
    const route = createGaussRoute(async () => {});
    expect(route.OPTIONS).toBeUndefined();
  });

  it("defaults to empty messages when not provided", async () => {
    const handler = vi.fn(async (_m, stream) => { stream.close(); });
    const route = createGaussRoute(handler);

    const request = makeRequest({});
    await route.POST(request);

    await new Promise((r) => setTimeout(r, 10));
    expect(handler.mock.calls[0][0]).toEqual([]);
  });

  it("includes custom headers in response", async () => {
    const route = createGaussRoute(
      async (_m, stream) => { stream.close(); },
      { headers: { "X-Custom": "value" } },
    );

    const request = makeRequest({ messages: [] });
    const response = await route.POST(request);

    expect(response.headers.get("X-Custom")).toBe("value");
  });

  it("supports array cors origins", async () => {
    const route = createGaussRoute(
      async (_m, stream) => { stream.close(); },
      { cors: ["https://a.com", "https://b.com"] },
    );

    const request = makeRequest({ messages: [] });
    const response = await route.POST(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://a.com, https://b.com",
    );
  });
});
