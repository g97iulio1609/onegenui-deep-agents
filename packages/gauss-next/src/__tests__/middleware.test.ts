import { describe, it, expect, vi } from "vitest";
import { withGauss } from "../middleware.js";

function createMockRequest(pathname: string, method = "GET") {
  return {
    nextUrl: { pathname },
    method,
  };
}

function createMockNext() {
  const headers = new Map<string, string>();
  return {
    fn: () => ({
      headers: {
        set: (name: string, value: string) => headers.set(name, value),
      },
    }),
    headers,
  };
}

describe("withGauss", () => {
  it("returns a function", () => {
    const middleware = withGauss();
    expect(typeof middleware).toBe("function");
  });

  it("passes through for non-matching paths", () => {
    const middleware = withGauss({ apiPath: "/api/chat" });
    const mock = createMockNext();
    const request = createMockRequest("/other/path");

    middleware(request, mock.fn);

    expect(mock.headers.size).toBe(0);
  });

  it("adds X-Accel-Buffering header for matching paths", () => {
    const middleware = withGauss({ apiPath: "/api/chat" });
    const mock = createMockNext();
    const request = createMockRequest("/api/chat");

    middleware(request, mock.fn);

    expect(mock.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("adds CORS headers when cors is set", () => {
    const middleware = withGauss({
      apiPath: "/api/chat",
      cors: "https://example.com",
    });
    const mock = createMockNext();
    const request = createMockRequest("/api/chat");

    middleware(request, mock.fn);

    expect(mock.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(mock.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("adds custom headers", () => {
    const middleware = withGauss({
      apiPath: "/api/chat",
      headers: { "X-Custom": "value" },
    });
    const mock = createMockNext();
    const request = createMockRequest("/api/chat");

    middleware(request, mock.fn);

    expect(mock.headers.get("X-Custom")).toBe("value");
  });

  it("matches paths starting with apiPath", () => {
    const middleware = withGauss({ apiPath: "/api/chat" });
    const mock = createMockNext();
    const request = createMockRequest("/api/chat/stream");

    middleware(request, mock.fn);

    expect(mock.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("defaults apiPath to /api/chat", () => {
    const middleware = withGauss();
    const mock = createMockNext();
    const request = createMockRequest("/api/chat");

    middleware(request, mock.fn);

    expect(mock.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("supports array cors origins", () => {
    const middleware = withGauss({
      cors: ["https://a.com", "https://b.com"],
    });
    const mock = createMockNext();
    const request = createMockRequest("/api/chat");

    middleware(request, mock.fn);

    expect(mock.headers.get("Access-Control-Allow-Origin")).toBe("https://a.com, https://b.com");
  });
});
