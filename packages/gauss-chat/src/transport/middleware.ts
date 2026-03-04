import type { ChatTransport } from "../types/index.js";

/** A middleware function that wraps a transport's send method. */
export type TransportMiddleware = (
  next: ChatTransport["send"],
) => ChatTransport["send"];

/** Apply an array of middleware to a transport, returning a new transport. */
export function applyMiddleware(
  transport: ChatTransport,
  middleware: TransportMiddleware[],
): ChatTransport {
  const send = middleware.reduceRight<ChatTransport["send"]>(
    (next, mw) => mw(next),
    transport.send.bind(transport),
  );
  return { send };
}
