/**
 * @gauss-ai/chat/server
 *
 * Server-side utilities for Gauss chat — stream helpers, route adapters.
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { GaussStream, toNextResponse } from "@gauss-ai/chat/server";
 *
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   const stream = new GaussStream();
 *   // ... pipe agent output to stream
 *   return toNextResponse(stream);
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { ChatMessage, StreamEvent } from "./types/index.js";

/** A writable stream that emits Gauss chat events as SSE. */
export class GaussStream {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private encoder = new TextEncoder();

  /** The underlying ReadableStream for piping to a Response. */
  readonly readable: ReadableStream<Uint8Array>;

  constructor() {
    this.readable = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
    });
  }

  /** Write a stream event (serialized as SSE). */
  write(event: StreamEvent): void {
    if (!this.controller) return;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(data));
  }

  /** Write a text delta. */
  writeText(text: string): void {
    this.write({ type: "text-delta", text });
  }

  /** Write a tool call event. */
  writeToolCall(toolName: string, toolCallId: string, args: Record<string, unknown>): void {
    this.write({ type: "tool-call", toolName, toolCallId, args });
  }

  /** Write a tool result event. */
  writeToolResult(toolCallId: string, result: unknown): void {
    this.write({ type: "tool-result", toolCallId, result });
  }

  /** Signal the end of the stream. */
  close(finishReason = "stop"): void {
    this.write({ type: "finish", finishReason });
    if (this.controller) {
      this.controller.enqueue(this.encoder.encode("data: [DONE]\n\n"));
      this.controller.close();
      this.controller = null;
    }
  }

  /** Signal an error and close the stream. */
  error(message: string): void {
    this.write({ type: "error", error: message });
    this.controller?.close();
    this.controller = null;
  }
}

/** Convert a GaussStream to a Next.js-compatible Response (App Router). */
export function toNextResponse(
  stream: GaussStream,
  init?: ResponseInit,
): Response {
  return new Response(stream.readable, {
    ...init,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...init?.headers,
    },
  });
}

/** Convert a GaussStream to a standard Web Response. */
export function toResponse(
  stream: GaussStream,
  init?: ResponseInit,
): Response {
  return toNextResponse(stream, init);
}

/**
 * Pipe an async iterable of text chunks into a GaussStream.
 *
 * Useful for wrapping agent.generate() or similar iterators.
 */
export async function pipeTextStream(
  source: AsyncIterable<string>,
  stream: GaussStream,
): Promise<void> {
  try {
    for await (const chunk of source) {
      stream.writeText(chunk);
    }
    stream.close();
  } catch (err) {
    stream.error(err instanceof Error ? err.message : String(err));
  }
}

// Re-export types used on server side
export type { StreamEvent } from "./types/index.js";
export type { ChatMessage, TransportOptions } from "./types/index.js";

// ─── Framework Route Adapters ────────────────────────────────────────────────

/** Handler function that receives messages and writes to a stream. */
export type StreamHandler = (
  messages: ChatMessage[],
  stream: GaussStream,
  body: Record<string, unknown>,
) => Promise<void>;

/* ── Express adapter ── */

interface ExpressLikeRequest {
  body: Record<string, unknown>;
}

interface ExpressLikeResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  on(event: string, listener: () => void): void;
}

/**
 * Create an Express/Connect route handler.
 *
 * @example
 * ```ts
 * import express from "express";
 * import { createExpressHandler } from "@gauss-ai/chat/server";
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.post("/api/chat", createExpressHandler(async (messages, stream) => {
 *   for await (const chunk of agent.stream(messages)) {
 *     stream.writeText(chunk);
 *   }
 * }));
 * ```
 */
export function createExpressHandler(
  handler: StreamHandler,
): (req: ExpressLikeRequest, res: ExpressLikeResponse) => void {
  return (req, res) => {
    const body = req.body ?? {};
    const messages = (body.messages ?? []) as ChatMessage[];
    const stream = new GaussStream();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const reader = stream.readable.getReader();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        res.end();
      }
    };

    pump();
    handler(messages, stream, body).catch((err) => {
      stream.error(err instanceof Error ? err.message : String(err));
    });
  };
}

/* ── Hono / Web-standard adapter ── */

interface HonoLikeContext {
  req: { json(): Promise<Record<string, unknown>> };
}

/**
 * Create a Hono/Bun/Deno-compatible route handler (Web Response-based).
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { createHonoHandler } from "@gauss-ai/chat/server";
 *
 * const app = new Hono();
 * app.post("/api/chat", createHonoHandler(async (messages, stream) => {
 *   for await (const chunk of agent.stream(messages)) {
 *     stream.writeText(chunk);
 *   }
 * }));
 * ```
 */
export function createHonoHandler(
  handler: StreamHandler,
): (c: HonoLikeContext) => Promise<Response> {
  return async (c) => {
    const body = await c.req.json();
    const messages = (body.messages ?? []) as ChatMessage[];
    const stream = new GaussStream();

    handler(messages, stream, body).catch((err) => {
      stream.error(err instanceof Error ? err.message : String(err));
    });

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  };
}
