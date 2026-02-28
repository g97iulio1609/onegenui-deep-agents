import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter } from "../rate-limiter.adapter.js";
import type { RateLimiterConfig } from "../../../ports/rate-limiter.port.js";

// ---------------------------------------------------------------------------
// Token Bucket
// ---------------------------------------------------------------------------
describe("InMemoryRateLimiter — token_bucket", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      algorithm: "token_bucket",
      maxRequests: 5,
      windowMs: 1000,
      burstSize: 5,
      refillRate: 10,
    });
  });

  it("allows requests within limit", async () => {
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("blocks when empty", async () => {
    for (let i = 0; i < 5; i++) await limiter.consume("a");
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("refills over time", async () => {
    for (let i = 0; i < 5; i++) await limiter.consume("a");
    await sleep(150);
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(true);
  });

  it("supports burst", async () => {
    const burst = new InMemoryRateLimiter({
      algorithm: "token_bucket",
      maxRequests: 2,
      windowMs: 1000,
      burstSize: 4,
      refillRate: 1,
    });
    for (let i = 0; i < 4; i++) {
      const r = await burst.consume("a");
      expect(r.allowed).toBe(true);
    }
    const r = await burst.consume("a");
    expect(r.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sliding Window
// ---------------------------------------------------------------------------
describe("InMemoryRateLimiter — sliding_window", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      algorithm: "sliding_window",
      maxRequests: 3,
      windowMs: 200,
    });
  });

  it("allows within window", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await limiter.consume("a");
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks when exceeded", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("a");
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(false);
  });

  it("slides correctly", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("a");
    await sleep(250);
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixed Window
// ---------------------------------------------------------------------------
describe("InMemoryRateLimiter — fixed_window", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      algorithm: "fixed_window",
      maxRequests: 3,
      windowMs: 200,
    });
  });

  it("allows within window", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await limiter.consume("a");
      expect(r.allowed).toBe(true);
    }
  });

  it("resets at boundary", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("a");
    const blocked = await limiter.consume("a");
    expect(blocked.allowed).toBe(false);
    await sleep(250);
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Leaky Bucket
// ---------------------------------------------------------------------------
describe("InMemoryRateLimiter — leaky_bucket", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      algorithm: "leaky_bucket",
      maxRequests: 5,
      windowMs: 1000,
    });
  });

  it("allows at rate", async () => {
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(true);
  });

  it("queues excess and blocks when full", async () => {
    for (let i = 0; i < 5; i++) await limiter.consume("a");
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Common behaviours
// ---------------------------------------------------------------------------
describe("InMemoryRateLimiter — common", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      algorithm: "token_bucket",
      maxRequests: 3,
      windowMs: 1000,
      burstSize: 3,
      refillRate: 10,
    });
  });

  it("check does not consume tokens", async () => {
    const c1 = await limiter.check("a");
    const c2 = await limiter.check("a");
    expect(c1.remaining).toBe(c2.remaining);
    expect(c1.allowed).toBe(true);
  });

  it("consume reduces available tokens", async () => {
    const before = await limiter.check("a");
    await limiter.consume("a");
    const after = await limiter.check("a");
    expect(after.remaining).toBe(before.remaining - 1);
  });

  it("state returns current state", async () => {
    await limiter.consume("a");
    const s = await limiter.state("a");
    expect(s.key).toBe("a");
    expect(s.currentTokens).toBe(2);
    expect(s.maxTokens).toBe(3);
    expect(s.requestCount).toBe(1);
  });

  it("reset clears rate limit", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("a");
    expect((await limiter.check("a")).allowed).toBe(false);
    await limiter.reset("a");
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("a")).remaining).toBe(3);
  });

  it("multiple keys are independent", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("x");
    const rx = await limiter.check("x");
    const ry = await limiter.check("y");
    expect(rx.allowed).toBe(false);
    expect(ry.allowed).toBe(true);
    expect(ry.remaining).toBe(3);
  });

  it("retryAfterMs is set when blocked", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("a");
    const r = await limiter.consume("a");
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeDefined();
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("remaining is accurate", async () => {
    expect((await limiter.consume("a")).remaining).toBe(2);
    expect((await limiter.consume("a")).remaining).toBe(1);
    expect((await limiter.consume("a")).remaining).toBe(0);
    expect((await limiter.consume("a")).remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
