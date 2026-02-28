// =============================================================================
// InMemoryRateLimiter — Multi-algorithm in-memory rate limiter
// =============================================================================

import type {
  RateLimiterPort,
  RateLimiterConfig,
  RateLimitResult,
  RateLimitState,
} from "../../ports/rate-limiter.port.js";

interface BucketState {
  tokens: number;
  lastRefill: number;
  windowStart: number;
  requestCount: number;
  timestamps: number[];
}

export class InMemoryRateLimiter implements RateLimiterPort {
  private readonly buckets = new Map<string, BucketState>();

  constructor(private readonly config: RateLimiterConfig) {}

  async check(key: string): Promise<RateLimitResult> {
    const bucket = this.getOrCreate(key);
    this.refresh(bucket);
    return this.buildResult(bucket, false);
  }

  async consume(key: string, tokens = 1): Promise<RateLimitResult> {
    const bucket = this.getOrCreate(key);
    this.refresh(bucket);
    return this.buildResult(bucket, true, tokens);
  }

  async state(key: string): Promise<RateLimitState> {
    const bucket = this.getOrCreate(key);
    this.refresh(bucket);
    return {
      key,
      currentTokens: this.available(bucket),
      maxTokens: this.capacity(),
      windowStart: bucket.windowStart,
      requestCount: bucket.requestCount,
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private capacity(): number {
    if (this.config.algorithm === "token_bucket") {
      return this.config.burstSize ?? this.config.maxRequests;
    }
    return this.config.maxRequests;
  }

  private getOrCreate(key: string): BucketState {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      const now = Date.now();
      bucket = {
        tokens:
          this.config.algorithm === "leaky_bucket" ? 0 : this.capacity(),
        lastRefill: now,
        windowStart: now,
        requestCount: 0,
        timestamps: [],
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refresh(bucket: BucketState): void {
    const now = Date.now();

    switch (this.config.algorithm) {
      case "token_bucket": {
        const elapsed = now - bucket.lastRefill;
        const rate = this.config.refillRate ?? 1;
        const added = (elapsed / 1000) * rate;
        bucket.tokens = Math.min(this.capacity(), bucket.tokens + added);
        bucket.lastRefill = now;
        break;
      }
      case "sliding_window": {
        const cutoff = now - this.config.windowMs;
        bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
        bucket.requestCount = bucket.timestamps.length;
        bucket.windowStart = cutoff;
        break;
      }
      case "fixed_window": {
        if (now - bucket.windowStart >= this.config.windowMs) {
          bucket.windowStart = now;
          bucket.requestCount = 0;
          bucket.tokens = this.config.maxRequests;
        }
        break;
      }
      case "leaky_bucket": {
        const elapsed = now - bucket.lastRefill;
        const leakRate = this.config.maxRequests / this.config.windowMs;
        const leaked = elapsed * leakRate;
        bucket.tokens = Math.max(0, bucket.tokens - leaked);
        bucket.lastRefill = now;
        break;
      }
    }
  }

  private available(bucket: BucketState): number {
    switch (this.config.algorithm) {
      case "token_bucket":
        return Math.floor(bucket.tokens);
      case "sliding_window":
        return Math.max(0, this.config.maxRequests - bucket.timestamps.length);
      case "fixed_window":
        return Math.max(0, this.config.maxRequests - bucket.requestCount);
      case "leaky_bucket": {
        const cap = this.config.burstSize ?? this.config.maxRequests;
        return Math.floor(cap - bucket.tokens);
      }
    }
  }

  private buildResult(
    bucket: BucketState,
    consume: boolean,
    tokens = 1,
  ): RateLimitResult {
    const now = Date.now();
    const avail = this.available(bucket);
    const allowed = avail >= tokens;

    if (allowed && consume) {
      this.applyConsume(bucket, tokens, now);
    }

    const remaining = allowed && consume ? avail - tokens : avail;

    return {
      allowed,
      remaining: Math.max(0, remaining),
      resetAt: this.computeResetAt(bucket, now),
      retryAfterMs: allowed ? undefined : this.computeRetryAfter(bucket, now),
    };
  }

  private applyConsume(bucket: BucketState, tokens: number, now: number): void {
    switch (this.config.algorithm) {
      case "token_bucket":
        bucket.tokens -= tokens;
        bucket.requestCount += tokens;
        break;
      case "sliding_window":
        for (let i = 0; i < tokens; i++) bucket.timestamps.push(now);
        bucket.requestCount = bucket.timestamps.length;
        break;
      case "fixed_window":
        bucket.requestCount += tokens;
        break;
      case "leaky_bucket":
        bucket.tokens += tokens;
        bucket.requestCount += tokens;
        break;
    }
  }

  private computeResetAt(bucket: BucketState, now: number): number {
    switch (this.config.algorithm) {
      case "token_bucket": {
        const rate = this.config.refillRate ?? 1;
        const needed = this.capacity() - bucket.tokens;
        return now + (needed / rate) * 1000;
      }
      case "sliding_window":
        return bucket.timestamps.length > 0
          ? bucket.timestamps[0] + this.config.windowMs
          : now + this.config.windowMs;
      case "fixed_window":
        return bucket.windowStart + this.config.windowMs;
      case "leaky_bucket": {
        const leakRate = this.config.maxRequests / this.config.windowMs;
        return bucket.tokens > 0
          ? now + bucket.tokens / leakRate
          : now + this.config.windowMs;
      }
    }
  }

  private computeRetryAfter(bucket: BucketState, now: number): number {
    switch (this.config.algorithm) {
      case "token_bucket": {
        const rate = this.config.refillRate ?? 1;
        const fractional = bucket.tokens - Math.floor(bucket.tokens);
        const needed = 1 - fractional;
        return Math.ceil((needed / rate) * 1000);
      }
      case "sliding_window":
        return bucket.timestamps.length > 0
          ? Math.max(0, bucket.timestamps[0] + this.config.windowMs - now)
          : 0;
      case "fixed_window":
        return Math.max(
          0,
          bucket.windowStart + this.config.windowMs - now,
        );
      case "leaky_bucket": {
        const leakRate = this.config.maxRequests / this.config.windowMs;
        return Math.ceil(1 / leakRate);
      }
    }
  }
}
