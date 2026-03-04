/**
 * App Router route handler factory.
 *
 * Returns an object with a `POST` method that can be directly exported
 * from a Next.js App Router route file.
 */

import { GaussStream } from "@gauss-ai/chat/server";
import type { ChatMessage, StreamEvent } from "@gauss-ai/chat/server";

/** Handler function that processes messages and writes to a stream. */
export type StreamHandler = (
  messages: ChatMessage[],
  stream: GaussStream,
  context: RouteContext,
) => Promise<void>;

/** Context passed to the stream handler. */
export interface RouteContext {
  /** The raw request body (parsed). */
  body: Record<string, unknown>;
  /** The original Request object. */
  request: Request;
}

/** Options for createGaussRoute. */
export interface GaussRouteOptions {
  /** Maximum request body size in bytes. Default: 1MB. */
  maxBodySize?: number;
  /** CORS origin(s). Set to `"*"` or a specific origin. Default: none. */
  cors?: string | string[];
  /** Custom response headers. */
  headers?: Record<string, string>;
  /** Called when handler throws. Default: sends error event and closes stream. */
  onError?: (error: unknown) => void;
}

/** The result of createGaussRoute — export this from your route.ts. */
export interface GaussRouteResult {
  POST: (request: Request) => Promise<Response>;
  OPTIONS?: (request: Request) => Response;
}

const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

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
 * Create a Next.js App Router route handler.
 *
 * @example
 * ```ts
 * // app/api/chat/route.ts
 * import { createGaussRoute } from "@gauss-ai/next";
 *
 * export const { POST } = createGaussRoute(async (messages, stream) => {
 *   for await (const chunk of myAgent.stream(messages)) {
 *     stream.writeText(chunk);
 *   }
 * });
 * ```
 */
export function createGaussRoute(
  handler: StreamHandler,
  options: GaussRouteOptions = {},
): GaussRouteResult {
  const { cors, headers: customHeaders, onError } = options;
  const corsHeaders = buildCorsHeaders(cors);

  const POST = async (request: Request): Promise<Response> => {
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const messages = (body.messages ?? []) as ChatMessage[];

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages must be an array" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const stream = new GaussStream();
    const context: RouteContext = { body, request };

    handler(messages, stream, context).catch((err) => {
      if (onError) {
        onError(err);
      }
      stream.error(err instanceof Error ? err.message : String(err));
    });

    return new Response(stream.readable, {
      headers: { ...SSE_HEADERS, ...corsHeaders, ...customHeaders },
    });
  };

  const result: GaussRouteResult = { POST };

  if (cors) {
    result.OPTIONS = (_request: Request) =>
      new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400",
        },
      });
  }

  return result;
}
