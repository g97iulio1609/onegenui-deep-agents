// =============================================================================
// PlaygroundServer — Standalone HTTP + WS server for the Gauss Playground
// =============================================================================

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createPlaygroundWSHandler, type PlaygroundWSMessage } from "./playground-ws.js";
import type { PlaygroundAgent } from "./playground-api.js";

// ─── Public Types ────────────────────────────────────────────────────────────

export interface PlaygroundServerOptions {
  port?: number;
  agents: Map<string, AgentDescriptor>;
}

export interface AgentDescriptor {
  id: string;
  name: string;
  description?: string;
  tools: ToolDescriptor[];
  invoke: (input: { prompt: string; sessionId?: string }) => AsyncIterable<PlaygroundEvent>;
}

export interface ToolDescriptor {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
}

export type PlaygroundEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: unknown }
  | { type: "tool_result"; name: string; result: unknown; durationMs: number }
  | { type: "error"; message: string }
  | { type: "done"; totalDurationMs: number; tokenCount?: number };

// ─── MIME Types ──────────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseUrl(url: string): { path: string; query: Record<string, string> } {
  const qIdx = url.indexOf("?");
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const query: Record<string, string> = {};
  if (qIdx >= 0) {
    for (const pair of url.slice(qIdx + 1).split("&")) {
      const eq = pair.indexOf("=");
      if (eq >= 0) {
        query[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
      }
    }
  }
  return { path: path.replace(/\/+$/, "") || "/", query };
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("error", reject);
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) { resolve(undefined); return; }
      try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
    });
  });
}

// ─── PlaygroundServer ────────────────────────────────────────────────────────

export class PlaygroundServer {
  private server: Server | null = null;
  private readonly agents: Map<string, AgentDescriptor>;
  private readonly port: number;
  private readonly staticDir: string;
  private wss: unknown = null;

  constructor(options: PlaygroundServerOptions) {
    this.agents = options.agents;
    this.port = options.port ?? 4600;
    this.staticDir = join(import.meta.dirname ?? __dirname, "..", "playground", "dist");
  }

  async start(): Promise<void> {
    this.server = createServer(async (req, res) => {
      // CORS preflight
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      try {
        await this.handleRequest(req, res);
      } catch (err) {
        if (!res.headersSent) {
          jsonResponse(res, 500, { error: err instanceof Error ? err.message : "Internal Server Error" });
        }
      }
    });

    // WebSocket upgrade via dynamic import of `ws`
    await this.setupWebSocket();

    return new Promise((resolve) => {
      this.server!.listen(this.port, "0.0.0.0", () => resolve());
    });
  }

  async stop(): Promise<void> {
    const wss = this.wss as { close?: (cb: () => void) => void } | null;
    if (wss?.close) {
      await new Promise<void>((r) => wss.close!(() => r()));
    }
    return new Promise((resolve, reject) => {
      if (!this.server) { resolve(); return; }
      this.server.close((err) => (err ? reject(err) : resolve()));
      this.server = null;
    });
  }

  getPort(): number {
    return this.port;
  }

  getHttpServer(): Server | null {
    return this.server;
  }

  // ─── Route Dispatcher ───────────────────────────────────────────────────

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? "GET").toUpperCase();
    const { path, query: _query } = parseUrl(req.url ?? "/");

    // API routes
    if (path === "/api/health" && method === "GET") {
      return this.handleHealth(res);
    }
    if (path === "/api/agents" && method === "GET") {
      return this.handleListAgents(res);
    }

    // /api/agents/:id
    const agentMatch = path.match(/^\/api\/agents\/([^/]+)$/);
    if (agentMatch) {
      if (method === "GET") return this.handleGetAgent(res, agentMatch[1]);
    }

    // /api/agents/:id/invoke
    const invokeMatch = path.match(/^\/api\/agents\/([^/]+)\/invoke$/);
    if (invokeMatch && method === "POST") {
      return this.handleInvoke(req, res, invokeMatch[1]);
    }

    // Serve static files for SPA
    if (method === "GET" && !path.startsWith("/api/")) {
      return this.serveStatic(res, path);
    }

    jsonResponse(res, 404, { error: "Not Found" });
  }

  // ─── API Handlers ──────────────────────────────────────────────────────

  private handleHealth(res: ServerResponse): void {
    jsonResponse(res, 200, {
      status: "ok",
      agents: this.agents.size,
      uptime: process.uptime(),
    });
  }

  private handleListAgents(res: ServerResponse): void {
    const list = Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description ?? "",
      tools: a.tools.map((t) => ({ name: t.name, description: t.description ?? "" })),
    }));
    jsonResponse(res, 200, list);
  }

  private handleGetAgent(res: ServerResponse, id: string): void {
    const agent = this.agents.get(id);
    if (!agent) {
      jsonResponse(res, 404, { error: `Agent "${id}" not found` });
      return;
    }
    jsonResponse(res, 200, {
      id: agent.id,
      name: agent.name,
      description: agent.description ?? "",
      tools: agent.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        schema: t.schema,
      })),
    });
  }

  private async handleInvoke(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) {
      jsonResponse(res, 404, { error: `Agent "${id}" not found` });
      return;
    }

    const body = (await readBody(req)) as { prompt?: string; sessionId?: string } | undefined;
    if (!body?.prompt) {
      jsonResponse(res, 400, { error: "Missing 'prompt' in request body" });
      return;
    }

    // SSE stream
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    try {
      const iterable = agent.invoke({ prompt: body.prompt, sessionId: body.sessionId });
      for await (const event of iterable) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      const errorEvent: PlaygroundEvent = {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    }
    res.end();
  }

  // ─── Static File Serving ───────────────────────────────────────────────

  private async serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
    const filePath = urlPath === "/" ? "/index.html" : urlPath;
    const fullPath = join(this.staticDir, filePath);

    try {
      const content = await readFile(fullPath);
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(content);
    } catch {
      // SPA fallback: serve index.html for client-side routing
      try {
        const index = await readFile(join(this.staticDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(index);
      } catch {
        jsonResponse(res, 404, { error: "Not Found" });
      }
    }
  }

  // ─── WebSocket Setup ───────────────────────────────────────────────────

  private async setupWebSocket(): Promise<void> {
    try {
      const wsModule = await import("ws") as unknown as Record<string, unknown>;
      const WebSocketServer = (wsModule.WebSocketServer ?? (wsModule.default as Record<string, unknown>)?.WebSocketServer) as
        (new (opts: { server: Server }) => { on: (event: string, cb: (...args: unknown[]) => void) => void; close: (cb: () => void) => void }) | undefined;
      if (!WebSocketServer) return;

      // Adapt AgentDescriptor map → PlaygroundAgent record for WS handler
      const agentRecord: Record<string, PlaygroundAgent> = {};
      for (const id of this.agents.keys()) {
        const desc = this.agents.get(id)!;
        agentRecord[id] = {
          name: desc.name,
          description: desc.description,
          tools: desc.tools.map((t) => ({ name: t.name, description: t.description ?? "" })),
          invoke: async (prompt: string, options?: { stream?: boolean; signal?: AbortSignal }) => {
            if (options?.stream) {
              return (async function* () {
                for await (const event of desc.invoke({ prompt })) {
                  if (options.signal?.aborted) break;
                  if (event.type === "text") yield event.content;
                  else if (event.type === "error") throw new Error(event.message);
                }
              })();
            }
            let result = "";
            for await (const event of desc.invoke({ prompt })) {
              if (event.type === "text") result += event.content;
              else if (event.type === "error") throw new Error(event.message);
            }
            return result;
          },
        };
      }

      const wss = new WebSocketServer({ server: this.server! });
      this.wss = wss;

      wss.on("connection", (...args: unknown[]) => {
        const ws = args[0] as { on: (event: string, cb: (...a: unknown[]) => void) => void; send: (data: string) => void };
        const handler = createPlaygroundWSHandler({ agents: agentRecord });

        ws.on("message", (...msgArgs: unknown[]) => {
          const data = msgArgs[0];
          const raw = typeof data === "string" ? data : String(data);
          handler.onMessage(raw, (msg: PlaygroundWSMessage) => {
            try { ws.send(JSON.stringify(msg)); } catch { /* disconnected */ }
          });
        });

        ws.on("close", () => handler.onClose());
      });
    } catch {
      // ws not available — WebSocket support disabled
    }
  }
}
