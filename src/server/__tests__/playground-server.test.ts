// =============================================================================
// PlaygroundServer Tests
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  PlaygroundServer,
  type AgentDescriptor,
  type PlaygroundEvent,
  type PlaygroundServerOptions,
} from "../playground-server.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

const TEST_PORT = 48920;

function createMockAgent(overrides?: Partial<AgentDescriptor>): AgentDescriptor {
  return {
    id: "echo",
    name: "Echo Agent",
    description: "Echoes input back",
    tools: [
      { name: "search", description: "Search the web", schema: { type: "object", properties: { query: { type: "string" } } } },
      { name: "calc", description: "Calculator" },
    ],
    invoke: async function* ({ prompt }): AsyncIterable<PlaygroundEvent> {
      yield { type: "text", content: `Echo: ${prompt}` };
      yield { type: "done", totalDurationMs: 42, tokenCount: 10 };
    },
    ...overrides,
  };
}

function createFailingAgent(): AgentDescriptor {
  return {
    id: "fail",
    name: "Failing Agent",
    description: "Always fails",
    tools: [],
    invoke: async function* (): AsyncIterable<PlaygroundEvent> {
      throw new Error("Agent exploded");
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PlaygroundServer", () => {
  let server: PlaygroundServer;
  const agents = new Map<string, AgentDescriptor>();

  beforeAll(async () => {
    agents.set("echo", createMockAgent());
    agents.set("fail", createFailingAgent());

    server = new PlaygroundServer({ port: TEST_PORT, agents });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  // 1. Server creates and listens
  it("should create and listen on the configured port", () => {
    expect(server.getPort()).toBe(TEST_PORT);
    expect(server.getHttpServer()).not.toBeNull();
  });

  // 2. GET /api/agents returns registered agents
  it("GET /api/agents returns all registered agents", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe("echo");
    expect(data[0].name).toBe("Echo Agent");
    expect(data[0].tools).toHaveLength(2);
    expect(data[1].id).toBe("fail");
  });

  // 3. GET /api/agents/:id returns single agent
  it("GET /api/agents/:id returns single agent details", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents/echo`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("echo");
    expect(data.name).toBe("Echo Agent");
    expect(data.description).toBe("Echoes input back");
    expect(data.tools).toHaveLength(2);
    expect(data.tools[0].schema).toBeDefined();
  });

  // 4. GET /api/agents/:id returns 404 for unknown agent
  it("GET /api/agents/:id returns 404 for unknown agent", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents/nonexistent`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  // 5. POST /api/agents/:id/invoke streams SSE events
  it("POST /api/agents/:id/invoke streams SSE events", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents/echo/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const text = await res.text();
    const events = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe("text");
    expect(events[0].content).toBe("Echo: hello");
    expect(events[1].type).toBe("done");
    expect(events[1].totalDurationMs).toBe(42);
  });

  // 6. POST /api/agents/:id/invoke returns 400 without prompt
  it("POST /api/agents/:id/invoke returns 400 without prompt", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents/echo/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("prompt");
  });

  // 7. POST /api/agents/:id/invoke returns 404 for unknown agent
  it("POST /api/agents/:id/invoke returns 404 for unknown agent", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents/missing/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });
    expect(res.status).toBe(404);
  });

  // 8. GET /api/health returns 200
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.agents).toBe(2);
    expect(typeof data.uptime).toBe("number");
  });

  // 9. 404 for unknown API routes
  it("returns 404 for unknown API routes", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/unknown`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not Found");
  });

  // 10. Error handling for invoke failures
  it("POST /api/agents/:id/invoke handles agent errors gracefully", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents/fail/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "trigger failure" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    const events = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));

    expect(events.length).toBeGreaterThanOrEqual(1);
    const errorEvent = events.find((e: { type: string }) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toBe("Agent exploded");
  });

  // 11. CORS preflight
  it("OPTIONS returns 204 for CORS preflight", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/agents`, {
      method: "OPTIONS",
    });
    expect(res.status).toBe(204);
  });

  // 12. SSE with tool_call and tool_result events
  it("POST /api/agents/:id/invoke streams tool events", async () => {
    const toolAgent = createMockAgent({
      id: "tools",
      invoke: async function* ({ prompt }): AsyncIterable<PlaygroundEvent> {
        yield { type: "tool_call", name: "search", args: { query: prompt } };
        yield { type: "tool_result", name: "search", result: { hits: 3 }, durationMs: 150 };
        yield { type: "text", content: "Found 3 results" };
        yield { type: "done", totalDurationMs: 200 };
      },
    });

    // Create a separate server for this test with the tool agent
    const toolAgents = new Map<string, AgentDescriptor>();
    toolAgents.set("tools", toolAgent);
    const toolServer = new PlaygroundServer({ port: TEST_PORT + 1, agents: toolAgents });
    await toolServer.start();

    try {
      const res = await fetch(`http://localhost:${TEST_PORT + 1}/api/agents/tools/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "find stuff" }),
      });

      const text = await res.text();
      const events = text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)));

      expect(events).toHaveLength(4);
      expect(events[0].type).toBe("tool_call");
      expect(events[0].name).toBe("search");
      expect(events[1].type).toBe("tool_result");
      expect(events[1].durationMs).toBe(150);
      expect(events[2].type).toBe("text");
      expect(events[3].type).toBe("done");
    } finally {
      await toolServer.stop();
    }
  });

  // 13. WebSocket connection + message exchange
  it("WebSocket connection and message exchange", async () => {
    // Skip if ws is not available
    let wsModule: { default?: { WebSocket?: unknown }; WebSocket?: unknown };
    try {
      wsModule = await import("ws");
    } catch {
      // ws not installed — skip test
      return;
    }

    const WS = (wsModule as { WebSocket?: new (url: string) => WebSocket }).WebSocket
      ?? (wsModule as { default?: { WebSocket?: new (url: string) => WebSocket } }).default?.WebSocket;
    if (!WS) return;

    const ws = new WS(`ws://localhost:${TEST_PORT}/ws`);

    const messages: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS timeout")), 5000);

      (ws as unknown as { on: (event: string, cb: (...args: unknown[]) => void) => void }).on("open", () => {
        (ws as unknown as { send: (data: string) => void }).send(
          JSON.stringify({ type: "run", agent: "echo", prompt: "ws-test" }),
        );
      });

      (ws as unknown as { on: (event: string, cb: (...args: unknown[]) => void) => void }).on("message", (data: unknown) => {
        const msg = JSON.parse(String(data));
        messages.push(msg);
        if (msg.type === "done" || msg.type === "error") {
          clearTimeout(timeout);
          resolve();
        }
      });

      (ws as unknown as { on: (event: string, cb: (...args: unknown[]) => void) => void }).on("error", (err: unknown) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    (ws as unknown as { close: () => void }).close();

    expect(messages.length).toBeGreaterThanOrEqual(1);
    const lastMsg = messages[messages.length - 1] as { type: string };
    expect(lastMsg.type).toBe("done");
  });
});
