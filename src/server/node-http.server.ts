// =============================================================================
// NodeHttpServer — Zero-dependency HTTP server using Node http module
// =============================================================================

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { HttpServerPort, HttpMethod, HttpRequest, HttpResponse, HttpHandler, HttpMiddleware, Route } from "../ports/http-server.port.js";

interface ParsedRoute {
  method: HttpMethod;
  segments: string[];
  paramNames: string[];
  handler: HttpHandler;
  middleware: HttpMiddleware[];
}

function parseUrl(url: string): { path: string; query: Record<string, string> } {
  const qIdx = url.indexOf("?");
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const query: Record<string, string> = {};
  if (qIdx >= 0) {
    const qs = url.slice(qIdx + 1);
    for (const pair of qs.split("&")) {
      const eq = pair.indexOf("=");
      if (eq >= 0) {
        query[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
      }
    }
  }
  return { path: path.replace(/\/+$/, "") || "/", query };
}

function matchRoute(routeSegments: string[], paramNames: string[], pathSegments: string[]): Record<string, string> | null {
  if (routeSegments.length !== pathSegments.length) return null;
  const params: Record<string, string> = {};
  let paramIdx = 0;
  for (let i = 0; i < routeSegments.length; i++) {
    if (routeSegments[i].startsWith(":")) {
      params[paramNames[paramIdx++]] = pathSegments[i];
    } else if (routeSegments[i] !== pathSegments[i]) {
      return null;
    }
  }
  return params;
}

function createResponse(raw: ServerResponse): HttpResponse {
  let statusCode = 200;
  let sent = false;
  const res: HttpResponse = {
    status(code: number) { statusCode = code; return res; },
    header(name: string, value: string) { raw.setHeader(name, value); return res; },
    json(data: unknown) {
      if (sent) return;
      sent = true;
      raw.writeHead(statusCode, { "Content-Type": "application/json" });
      raw.end(JSON.stringify(data));
    },
    text(data: string) {
      if (sent) return;
      sent = true;
      raw.writeHead(statusCode, { "Content-Type": "text/plain" });
      raw.end(data);
    },
    async stream(generator: AsyncGenerator<string>) {
      if (sent) return;
      sent = true;
      raw.writeHead(statusCode, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
      try {
        for await (const chunk of generator) {
          raw.write(`data: ${chunk}\n\n`);
        }
      } catch (err) {
        raw.write(`event: error\ndata: ${err instanceof Error ? err.message : "stream error"}\n\n`);
      }
      raw.end();
    },
  };
  return res;
}

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

async function readBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("error", (err) => reject(err));
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error("Request body too large")); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) { resolve(undefined); return; }
      try { resolve(JSON.parse(raw)); }
      catch { resolve(raw); }
    });
  });
}

export class NodeHttpServer implements HttpServerPort {
  private server: Server | null = null;
  private parsedRoutes: ParsedRoute[] = [];
  private globalMiddleware: HttpMiddleware[] = [];
  private registeredRoutes: Route[] = [];
  private corsOrigin: string;
  private maxBodyBytes: number;

  constructor(opts?: { cors?: string; maxBodyBytes?: number }) {
    this.corsOrigin = opts?.cors ?? "*";
    this.maxBodyBytes = opts?.maxBodyBytes ?? MAX_BODY_BYTES;
  }

  route(method: HttpMethod, path: string, handler: HttpHandler, middleware?: HttpMiddleware[]): void {
    const segments = path.split("/").filter(Boolean);
    const paramNames = segments.filter(s => s.startsWith(":")).map(s => s.slice(1));
    this.parsedRoutes.push({ method, segments, paramNames, handler, middleware: middleware ?? [] });
    this.registeredRoutes.push({ method, path, handler, middleware });
  }

  use(mw: HttpMiddleware): void {
    this.globalMiddleware.push(mw);
  }

  routes(): Route[] {
    return [...this.registeredRoutes];
  }

  async listen(port: number, hostname?: string): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer(async (rawReq, rawRes) => {
        // CORS
        rawRes.setHeader("Access-Control-Allow-Origin", this.corsOrigin);
        rawRes.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
        rawRes.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
        if (rawReq.method === "OPTIONS") {
          rawRes.writeHead(204);
          rawRes.end();
          return;
        }

        try {
          const { path, query } = parseUrl(rawReq.url ?? "/");
          const pathSegments = path.split("/").filter(Boolean);
          const method = (rawReq.method ?? "GET").toUpperCase() as HttpMethod;

          // Find matching route
          let matched: ParsedRoute | undefined;
          let params: Record<string, string> = {};
          for (const r of this.parsedRoutes) {
            if (r.method !== method) continue;
            const m = matchRoute(r.segments, r.paramNames, pathSegments);
            if (m) { matched = r; params = m; break; }
          }

          if (!matched) {
            rawRes.writeHead(404, { "Content-Type": "application/json" });
            rawRes.end(JSON.stringify({ error: "Not Found" }));
            return;
          }

          const body = await readBody(rawReq, this.maxBodyBytes);
          const req: HttpRequest = {
            method, path, query, body, params,
            headers: rawReq.headers as Record<string, string | string[] | undefined>,
          };
          const res = createResponse(rawRes);

          // Execute middleware chain: global → route-level → handler
          const allMw = [...this.globalMiddleware, ...matched.middleware];
          let idx = 0;
          const next = async (): Promise<void> => {
            if (idx < allMw.length) {
              const mw = allMw[idx++];
              await mw(req, res, next);
            } else {
              await matched!.handler(req, res);
            }
          };
          await next();
        } catch (err) {
          if (!rawRes.headersSent) {
            rawRes.writeHead(500, { "Content-Type": "application/json" });
            rawRes.end(JSON.stringify({ error: err instanceof Error ? err.message : "Internal Server Error" }));
          }
        }
      });
      this.server.listen(port, hostname ?? "0.0.0.0", () => resolve());
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) { resolve(); return; }
      this.server.close((err) => err ? reject(err) : resolve());
      this.server = null;
    });
  }
}
