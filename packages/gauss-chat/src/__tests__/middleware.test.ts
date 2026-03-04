import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatTransport, StreamEvent, TransportOptions, ChatMessage } from "../types/index.js";
import { applyMiddleware } from "../transport/middleware.js";
import type { TransportMiddleware } from "../transport/middleware.js";
import { retryMiddleware } from "../transport/retry-middleware.js";
import { loggingMiddleware } from "../transport/logging-middleware.js";
import { rateLimitMiddleware, RateLimitError } from "../transport/rate-limit-middleware.js";
import { hooksMiddleware } from "../transport/hooks-middleware.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

type SendOpts = TransportOptions & { signal: AbortSignal };

const defaultOpts = (): SendOpts => ({
  api: "/api/chat",
  signal: new AbortController().signal,
});

const msgs: ChatMessage[] = [
  { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] },
];

function createMockTransport(events: StreamEvent[]): ChatTransport {
  return {
    async *send() {
      for (const event of events) yield event;
    },
  };
}

function createFailingTransport(error: Error, succeedAfter?: number): ChatTransport {
  let attempts = 0;
  return {
    async *send() {
      attempts++;
      if (succeedAfter && attempts >= succeedAfter) {
        yield { type: "text-delta" as const, text: "ok" };
        return;
      }
      throw error;
    },
  };
}

async function collect(iter: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

/* ------------------------------------------------------------------ */
/*  applyMiddleware                                                   */
/* ------------------------------------------------------------------ */

describe("applyMiddleware", () => {
  it("composes correctly — first middleware is outermost", async () => {
    const order: string[] = [];

    const mwA: TransportMiddleware = (next) =>
      async function* (m, o) {
        order.push("A-before");
        yield* next(m, o);
        order.push("A-after");
      };

    const mwB: TransportMiddleware = (next) =>
      async function* (m, o) {
        order.push("B-before");
        yield* next(m, o);
        order.push("B-after");
      };

    const transport = createMockTransport([{ type: "text-delta", text: "x" }]);
    const wrapped = applyMiddleware(transport, [mwA, mwB]);
    await collect(wrapped.send(msgs, defaultOpts()));

    expect(order).toEqual(["A-before", "B-before", "B-after", "A-after"]);
  });
});

/* ------------------------------------------------------------------ */
/*  retryMiddleware                                                   */
/* ------------------------------------------------------------------ */

describe("retryMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries on error with exponential backoff", async () => {
    const transport = createFailingTransport(new Error("fail"), 3);
    const onRetry = vi.fn();
    const wrapped = applyMiddleware(transport, [
      retryMiddleware({ maxRetries: 3, baseDelay: 10, onRetry }),
    ]);

    const events = await collect(wrapped.send(msgs, defaultOpts()));
    expect(events).toEqual([{ type: "text-delta", text: "ok" }]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("respects maxRetries limit", async () => {
    const transport = createFailingTransport(new Error("fail"));
    const wrapped = applyMiddleware(transport, [
      retryMiddleware({ maxRetries: 2, baseDelay: 1 }),
    ]);

    await expect(collect(wrapped.send(msgs, defaultOpts()))).rejects.toThrow("fail");
  });

  it("does not retry on abort", async () => {
    const abortController = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    const transport = createFailingTransport(abortError);
    const onRetry = vi.fn();
    const wrapped = applyMiddleware(transport, [
      retryMiddleware({ maxRetries: 3, baseDelay: 1, onRetry }),
    ]);

    abortController.abort();
    await expect(
      collect(wrapped.send(msgs, { api: "/api/chat", signal: abortController.signal })),
    ).rejects.toThrow();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("calls onRetry callback with attempt, error, and delay", async () => {
    const transport = createFailingTransport(new Error("boom"), 2);
    const onRetry = vi.fn();
    const wrapped = applyMiddleware(transport, [
      retryMiddleware({ maxRetries: 3, baseDelay: 100, jitter: 0, onRetry }),
    ]);

    await collect(wrapped.send(msgs, defaultOpts()));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
  });
});

/* ------------------------------------------------------------------ */
/*  loggingMiddleware                                                 */
/* ------------------------------------------------------------------ */

describe("loggingMiddleware", () => {
  it("logs request start and timing", async () => {
    const logger = vi.fn();
    const transport = createMockTransport([{ type: "text-delta", text: "x" }]);
    const wrapped = applyMiddleware(transport, [loggingMiddleware({ logger })]);

    await collect(wrapped.send(msgs, defaultOpts()));

    expect(logger).toHaveBeenCalledWith("info", "Request started", expect.objectContaining({ messageCount: 1 }));
    expect(logger).toHaveBeenCalledWith("info", "Request completed", expect.objectContaining({ durationMs: expect.any(Number) }));
  });

  it("optionally logs events", async () => {
    const logger = vi.fn();
    const transport = createMockTransport([
      { type: "text-delta", text: "a" },
      { type: "text-delta", text: "b" },
    ]);
    const wrapped = applyMiddleware(transport, [
      loggingMiddleware({ logger, logEvents: true }),
    ]);

    await collect(wrapped.send(msgs, defaultOpts()));

    const debugCalls = logger.mock.calls.filter(
      ([level]: [string]) => level === "debug",
    );
    expect(debugCalls).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/*  rateLimitMiddleware                                               */
/* ------------------------------------------------------------------ */

describe("rateLimitMiddleware", () => {
  it("allows requests under limit", async () => {
    const transport = createMockTransport([{ type: "text-delta", text: "ok" }]);
    const wrapped = applyMiddleware(transport, [
      rateLimitMiddleware({ maxRequests: 5, windowMs: 1000 }),
    ]);

    for (let i = 0; i < 5; i++) {
      const events = await collect(wrapped.send(msgs, defaultOpts()));
      expect(events).toHaveLength(1);
    }
  });

  it("blocks requests over limit", async () => {
    const transport = createMockTransport([{ type: "text-delta", text: "ok" }]);
    const onRateLimited = vi.fn();
    const wrapped = applyMiddleware(transport, [
      rateLimitMiddleware({ maxRequests: 2, windowMs: 60_000, onRateLimited }),
    ]);

    await collect(wrapped.send(msgs, defaultOpts()));
    await collect(wrapped.send(msgs, defaultOpts()));

    await expect(collect(wrapped.send(msgs, defaultOpts()))).rejects.toThrow(RateLimitError);
    expect(onRateLimited).toHaveBeenCalledWith(expect.any(Number));
  });

  it("resets after window", async () => {
    vi.useFakeTimers();
    const transport = createMockTransport([{ type: "text-delta", text: "ok" }]);
    const wrapped = applyMiddleware(transport, [
      rateLimitMiddleware({ maxRequests: 1, windowMs: 1000 }),
    ]);

    await collect(wrapped.send(msgs, defaultOpts()));
    await expect(collect(wrapped.send(msgs, defaultOpts()))).rejects.toThrow(RateLimitError);

    vi.advanceTimersByTime(1001);

    const events = await collect(wrapped.send(msgs, defaultOpts()));
    expect(events).toHaveLength(1);
    vi.useRealTimers();
  });
});

/* ------------------------------------------------------------------ */
/*  hooksMiddleware                                                   */
/* ------------------------------------------------------------------ */

describe("hooksMiddleware", () => {
  it("calls beforeSend before request", async () => {
    const order: string[] = [];
    const transport: ChatTransport = {
      async *send() {
        order.push("send");
        yield { type: "text-delta" as const, text: "x" };
      },
    };

    const wrapped = applyMiddleware(transport, [
      hooksMiddleware({
        beforeSend: () => {
          order.push("beforeSend");
        },
      }),
    ]);

    await collect(wrapped.send(msgs, defaultOpts()));
    expect(order).toEqual(["beforeSend", "send"]);
  });

  it("calls onEvent for each event", async () => {
    const onEvent = vi.fn();
    const events: StreamEvent[] = [
      { type: "text-delta", text: "a" },
      { type: "text-delta", text: "b" },
      { type: "finish", finishReason: "stop" },
    ];
    const transport = createMockTransport(events);
    const wrapped = applyMiddleware(transport, [hooksMiddleware({ onEvent })]);

    await collect(wrapped.send(msgs, defaultOpts()));
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenCalledWith(events[0]);
    expect(onEvent).toHaveBeenCalledWith(events[1]);
    expect(onEvent).toHaveBeenCalledWith(events[2]);
  });

  it("calls onComplete with stats", async () => {
    const onComplete = vi.fn();
    const transport = createMockTransport([
      { type: "text-delta", text: "a" },
      { type: "text-delta", text: "b" },
    ]);
    const wrapped = applyMiddleware(transport, [hooksMiddleware({ onComplete })]);

    await collect(wrapped.send(msgs, defaultOpts()));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ eventCount: 2, durationMs: expect.any(Number) }),
    );
  });

  it("calls onError on failure", async () => {
    const onError = vi.fn();
    const transport = createFailingTransport(new Error("boom"));
    const wrapped = applyMiddleware(transport, [hooksMiddleware({ onError })]);

    await expect(collect(wrapped.send(msgs, defaultOpts()))).rejects.toThrow("boom");
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
