import { describe, it, expect, afterEach } from "vitest";
import { NodeHttpServer } from "../../server/node-http.server.js";
import type { HttpMiddleware } from "../../ports/http-server.port.js";

// Use a random port range to avoid collisions
let port = 19_000 + Math.floor(Math.random() * 1000);
const nextPort = () => ++port;

async function fetchJson(url: string, opts?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe("NodeHttpServer", () => {
  let server: NodeHttpServer;

  afterEach(async () => {
    await server?.close();
  });

  it("handles GET route with params and query", async () => {
    server = new NodeHttpServer();
    server.route("GET", "/agents/:name", async (req, res) => {
      res.json({ name: req.params.name, q: req.query.q });
    });
    const p = nextPort();
    await server.listen(p);
    const { status, body } = await fetchJson(`http://127.0.0.1:${p}/agents/test-agent?q=hello`);
    expect(status).toBe(200);
    expect(body).toEqual({ name: "test-agent", q: "hello" });
  });

  it("handles POST with JSON body", async () => {
    server = new NodeHttpServer();
    server.route("POST", "/data", async (req, res) => {
      res.status(201).json({ received: req.body });
    });
    const p = nextPort();
    await server.listen(p);
    const { status, body } = await fetchJson(`http://127.0.0.1:${p}/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });
    expect(status).toBe(201);
    expect(body).toEqual({ received: { key: "value" } });
  });

  it("returns 404 for unmatched routes", async () => {
    server = new NodeHttpServer();
    const p = nextPort();
    await server.listen(p);
    const { status } = await fetchJson(`http://127.0.0.1:${p}/nope`);
    expect(status).toBe(404);
  });

  it("runs global + route middleware in order", async () => {
    server = new NodeHttpServer();
    const order: string[] = [];
    const globalMw: HttpMiddleware = async (_req, _res, next) => { order.push("global"); await next(); };
    const routeMw: HttpMiddleware = async (_req, _res, next) => { order.push("route"); await next(); };
    server.use(globalMw);
    server.route("GET", "/mw", async (_req, res) => { order.push("handler"); res.json({ ok: true }); }, [routeMw]);
    const p = nextPort();
    await server.listen(p);
    await fetchJson(`http://127.0.0.1:${p}/mw`);
    expect(order).toEqual(["global", "route", "handler"]);
  });

  it("middleware can short-circuit (no next())", async () => {
    server = new NodeHttpServer();
    const blocker: HttpMiddleware = async (_req, res) => { res.status(403).json({ error: "blocked" }); };
    server.use(blocker);
    server.route("GET", "/blocked", async (_req, res) => { res.json({ should: "not reach" }); });
    const p = nextPort();
    await server.listen(p);
    const { status, body } = await fetchJson(`http://127.0.0.1:${p}/blocked`);
    expect(status).toBe(403);
    expect(body).toEqual({ error: "blocked" });
  });

  it("CORS preflight returns 204", async () => {
    server = new NodeHttpServer({ cors: "https://example.com" });
    const p = nextPort();
    await server.listen(p);
    const res = await fetch(`http://127.0.0.1:${p}/anything`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com");
  });

  it("handler errors return 500", async () => {
    server = new NodeHttpServer();
    server.route("GET", "/fail", async () => { throw new Error("boom"); });
    const p = nextPort();
    await server.listen(p);
    const { status, body } = await fetchJson(`http://127.0.0.1:${p}/fail`);
    expect(status).toBe(500);
    expect(body).toEqual({ error: "boom" });
  });

  it("streams SSE", async () => {
    server = new NodeHttpServer();
    server.route("GET", "/stream", async (_req, res) => {
      async function* gen() { yield "one"; yield "two"; }
      await res.stream(gen());
    });
    const p = nextPort();
    await server.listen(p);
    const raw = await fetch(`http://127.0.0.1:${p}/stream`);
    const text = await raw.text();
    expect(text).toContain("data: one");
    expect(text).toContain("data: two");
    expect(raw.headers.get("content-type")).toBe("text/event-stream");
  });

  it("lists registered routes", async () => {
    server = new NodeHttpServer();
    server.route("GET", "/a", async (_req, res) => res.json({}));
    server.route("POST", "/b", async (_req, res) => res.json({}));
    const routes = server.routes();
    expect(routes).toHaveLength(2);
    expect(routes[0].method).toBe("GET");
    expect(routes[1].path).toBe("/b");
  });
});
