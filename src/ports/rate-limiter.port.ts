// =============================================================================
// RateLimiterPort — Multi-algorithm rate limiting contract
// =============================================================================

export type RateLimitAlgorithm = 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket';

export interface RateLimiterPort {
  /** Check if a request is allowed */
  check(key: string): Promise<RateLimitResult>;

  /** Consume tokens/requests from the limiter */
  consume(key: string, tokens?: number): Promise<RateLimitResult>;

  /** Get current state for a key */
  state(key: string): Promise<RateLimitState>;

  /** Reset a key's rate limit */
  reset(key: string): Promise<void>;
}

export interface RateLimiterConfig {
  algorithm: RateLimitAlgorithm;
  maxRequests: number;
  windowMs: number;
  burstSize?: number;
  refillRate?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export interface RateLimitState {
  key: string;
  currentTokens: number;
  maxTokens: number;
  windowStart: number;
  requestCount: number;
}
