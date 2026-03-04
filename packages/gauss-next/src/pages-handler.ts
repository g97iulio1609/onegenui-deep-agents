/**
 * Pages Router API handler factory.
 *
 * Returns a handler compatible with Next.js Pages Router API routes.
 */

import { GaussStream } from "@gauss-ai/chat/server";
import type { ChatMessage } from "@gauss-ai/chat/server";

/** Handler function for Pages Router. */
export type PagesStreamHandler = (
  messages: ChatMessage[],
  stream: GaussStream,
  context: PagesRouteContext,
) => Promise<void>;

/** Context for Pages Router handler. */
export interface PagesRouteContext {
  body: Record<string, unknown>;
}

/** Options for createGaussPagesRoute. */
export interface GaussPagesRouteOptions {
  /** CORS origin. */
  cors?: string | string[];
  /** Custom response headers. */
  headers?: Record<string, string>;
  /** Called when handler throws. */
  onError?: (error: unknown) => void;
}

/** Next.js Pages Router request shape. */
interface PagesRequest {
  method?: string;
  body: unknown;
}

/** Next.js Pages Router response shape. */
interface PagesResponse {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  setHeader(name: string, value: string): void;
  status(code: number): PagesResponse;
  json(body: unknown): void;
}

function buildCorsHeaders(
  cors: string | string[] | undefined,
): Record<string, string> {
  if (!cors) return {};
  const origin = Array.isArray(cors) ? cors.join(", ") : cors;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Create a Next.js Pages Router API route handler.
 *
 * @example
 * ```ts
 * // pages/api/chat.ts
 * import { createGaussPagesRoute } from "@gauss-ai/next";
 *
 * export default createGaussPagesRoute(async (messages, stream) => {
 *   for await (const chunk of myAgent.stream(messages)) {
 *     stream.writeText(chunk);
 *   }
 * });
 * ```
 */
export function createGaussPagesRoute(
  handler: PagesStreamHandler,
  options: GaussPagesRouteOptions = {},
): (req: PagesRequest, res: PagesResponse) => void {
  const { cors, headers: customHeaders, onError } = options;
  const corsHeaders = buildCorsHeaders(cors);

  return (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS" && cors) {
      res.writeHead(204, {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const messages = (body.messages ?? []) as ChatMessage[];

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "messages must be an array" });
      return;
    }

    const stream = new GaussStream();
    const context: PagesRouteContext = { body };

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsHeaders,
      ...customHeaders,
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
        reader.releaseLock();
        res.end();
      }
    };

    pump();
    handler(messages, stream, context).catch((err) => {
      if (onError) {
        onError(err);
      }
      stream.error(err instanceof Error ? err.message : String(err));
    });
  };
}
