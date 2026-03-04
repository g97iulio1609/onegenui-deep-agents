import type { ChatTransport } from "../types/index.js";
import type { TransportMiddleware } from "./middleware.js";

export interface LoggingOptions {
  /** Log function (default: console.debug). */
  logger?: (
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>,
  ) => void;
  /** Log request details (default: true). */
  logRequests?: boolean;
  /** Log response events (default: false, verbose). */
  logEvents?: boolean;
  /** Log timing (default: true). */
  logTiming?: boolean;
}

const defaultLogger: LoggingOptions["logger"] = (level, message, data) => {
  // eslint-disable-next-line no-console
  console.debug(`[transport:${level}] ${message}`, data ?? "");
};

export function loggingMiddleware(options?: LoggingOptions): TransportMiddleware {
  const logger: NonNullable<LoggingOptions["logger"]> =
    options?.logger ?? defaultLogger!;
  const logRequests = options?.logRequests ?? true;
  const logEvents = options?.logEvents ?? false;
  const logTiming = options?.logTiming ?? true;

  return (next: ChatTransport["send"]): ChatTransport["send"] =>
    async function* loggingSend(messages, opts) {
      const start = Date.now();

      if (logRequests) {
        logger("info", "Request started", {
          messageCount: messages.length,
          api: opts.api,
        });
      }

      try {
        for await (const event of next(messages, opts)) {
          if (logEvents) {
            logger("debug", `Event: ${event.type}`, { event });
          }
          yield event;
        }

        if (logTiming) {
          logger("info", "Request completed", { durationMs: Date.now() - start });
        }
      } catch (error: unknown) {
        const durationMs = Date.now() - start;
        logger("error", "Request failed", {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
}
