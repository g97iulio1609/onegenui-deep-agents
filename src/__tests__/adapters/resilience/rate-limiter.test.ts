import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter, RateLimiterError, DEFAULT_RATE_LIMITER_CONFIG } from "../../../adapters/resilience/rate-limiter.js";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxTokens: 5,
      refillRateMs: 100,
    });
  });

  describe("initial state", () => {
    it("should start with max tokens available", () => {
      expect(rateLimiter.availableTokens).toBe(5);
    });
  });

  describe("tryAcquire", () => {
    it("should successfully acquire tokens when available", () => {
      expect(rateLimiter.tryAcquire()).toBe(true);
      expect(rateLimiter.availableTokens).toBe(4);
      
      expect(rateLimiter.tryAcquire()).toBe(true);
      expect(rateLimiter.availableTokens).toBe(3);
    });

    it("should fail to acquire tokens when exhausted", () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.tryAcquire()).toBe(true);
      }
      
      expect(rateLimiter.availableTokens).toBe(0);
      expect(rateLimiter.tryAcquire()).toBe(false);
    });

    it("should refill tokens over time", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }
      
      expect(rateLimiter.availableTokens).toBe(0);
      expect(rateLimiter.tryAcquire()).toBe(false);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(rateLimiter.availableTokens).toBe(1);
      expect(rateLimiter.tryAcquire()).toBe(true);
    });

    it("should not exceed max tokens during refill", async () => {
      // Start with some tokens used
      expect(rateLimiter.tryAcquire()).toBe(true);
      expect(rateLimiter.availableTokens).toBe(4);

      // Wait for multiple refill periods
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should not exceed max tokens
      expect(rateLimiter.availableTokens).toBe(5);
    });
  });

  describe("acquire", () => {
    it("should immediately return when tokens are available", async () => {
      const start = Date.now();
      await rateLimiter.acquire();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10); // Should be nearly instant
      expect(rateLimiter.availableTokens).toBe(4);
    });

    it("should wait for token refill when exhausted", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.acquire();
      }
      
      expect(rateLimiter.availableTokens).toBe(0);

      const start = Date.now();
      await rateLimiter.acquire();
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThan(80); // Should wait for refill
      expect(rateLimiter.availableTokens).toBe(0); // Token was consumed
    });

    it("should handle multiple concurrent acquire requests", async () => {
      // Exhaust tokens first
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      const promises = [
        rateLimiter.acquire(),
        rateLimiter.acquire(),
        rateLimiter.acquire(),
      ];

      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      // Should take approximately 2-3 refill cycles (200-300ms)
      expect(duration).toBeGreaterThan(180);
      expect(duration).toBeLessThan(400);
      
      // Token bucket refills 1 token per refillRateMs; 3 refilled and 3 consumed
      expect(rateLimiter.availableTokens).toBe(0);
    });
  });

  describe("token refill", () => {
    it("should refill tokens at specified rate", async () => {
      const slowRateLimiter = new RateLimiter({
        maxTokens: 3,
        refillRateMs: 200,
      });

      // Use all tokens
      for (let i = 0; i < 3; i++) {
        slowRateLimiter.tryAcquire();
      }
      expect(slowRateLimiter.availableTokens).toBe(0);

      // Wait for one refill period
      await new Promise(resolve => setTimeout(resolve, 250));
      expect(slowRateLimiter.availableTokens).toBe(1);

      // Wait for another refill period
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(slowRateLimiter.availableTokens).toBe(2);
    });

    it("should handle partial refill timing correctly", async () => {
      const rateLimiter = new RateLimiter({
        maxTokens: 10,
        refillRateMs: 100,
      });

      // Use some tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.availableTokens).toBe(5);

      // Wait for 1.5 refill periods
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(rateLimiter.availableTokens).toBe(6); // Only 1 token should be added

      // Wait for another full refill period
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(rateLimiter.availableTokens).toBe(7);
    });
  });

  describe("reset", () => {
    it("should reset to max tokens and reject waiting requests", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      // Start a waiting request
      const acquirePromise = rateLimiter.acquire();

      // Reset the rate limiter
      rateLimiter.reset();

      // Should have max tokens again
      expect(rateLimiter.availableTokens).toBe(5);

      // Waiting request should be rejected
      await expect(acquirePromise).rejects.toThrow(RateLimiterError);
      await expect(acquirePromise).rejects.toThrow("Rate limiter was reset");
    });

    it("should reject multiple waiting requests on reset", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      // Start multiple waiting requests
      const promises = [
        rateLimiter.acquire(),
        rateLimiter.acquire(),
        rateLimiter.acquire(),
      ];

      rateLimiter.reset();

      // All should be rejected
      for (const promise of promises) {
        await expect(promise).rejects.toThrow(RateLimiterError);
      }
    });
  });

  describe("queue processing", () => {
    it("should process queue in FIFO order", async () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      const results: number[] = [];
      const promises = [
        rateLimiter.acquire().then(() => results.push(1)),
        rateLimiter.acquire().then(() => results.push(2)),
        rateLimiter.acquire().then(() => results.push(3)),
      ];

      await Promise.all(promises);

      expect(results).toEqual([1, 2, 3]);
    });

    it("should not schedule multiple timers for concurrent waiters", async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const timerCountBefore = setTimeoutSpy.mock.calls.length;

      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      // Queue multiple concurrent acquire() calls
      const promises = [
        rateLimiter.acquire(),
        rateLimiter.acquire(),
        rateLimiter.acquire(),
      ];

      const timerCountAfter = setTimeoutSpy.mock.calls.length;
      // Only one timer should be scheduled despite 3 concurrent waiters
      expect(timerCountAfter - timerCountBefore).toBe(1);

      await Promise.all(promises);
      setTimeoutSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle zero max tokens", () => {
      const zeroTokenLimiter = new RateLimiter({
        maxTokens: 0,
        refillRateMs: 100,
      });

      expect(zeroTokenLimiter.availableTokens).toBe(0);
      expect(zeroTokenLimiter.tryAcquire()).toBe(false);
    });

    it("should handle very fast refill rate", async () => {
      const fastLimiter = new RateLimiter({
        maxTokens: 2,
        refillRateMs: 1, // 1ms refill
      });

      fastLimiter.tryAcquire();
      fastLimiter.tryAcquire();
      expect(fastLimiter.availableTokens).toBe(0);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(fastLimiter.availableTokens).toBe(2);
    });
  });

  describe("default config", () => {
    it("should use default configuration", () => {
      const defaultLimiter = new RateLimiter();
      expect(defaultLimiter.availableTokens).toBe(10);
    });

    it("should export default config constants", () => {
      expect(DEFAULT_RATE_LIMITER_CONFIG).toEqual({
        maxTokens: 10,
        refillRateMs: 1000,
      });
    });
  });

  describe("RateLimiterError", () => {
    it("should be properly named", () => {
      const error = new RateLimiterError("test message");
      expect(error.name).toBe("RateLimiterError");
      expect(error.message).toBe("test message");
      expect(error).toBeInstanceOf(Error);
    });
  });
});