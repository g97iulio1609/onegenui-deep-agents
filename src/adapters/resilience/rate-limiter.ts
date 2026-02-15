/**
 * Rate Limiter using token bucket algorithm
 */

export interface RateLimiterConfig {
  readonly maxTokens: number;
  readonly refillRateMs: number;
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxTokens: 10,
  refillRateMs: 1000,
};

export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private waitQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  private processingScheduled = false;

  constructor(private readonly config: RateLimiterConfig = DEFAULT_RATE_LIMITER_CONFIG) {
    this.tokens = config.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    if (this.tryAcquire()) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Try to acquire a token immediately
   * @returns true if token acquired, false otherwise
   */
  tryAcquire(): boolean {
    this.refillTokens();
    
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    
    return false;
  }

  /**
   * Get number of available tokens
   */
  get availableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }

  /**
   * Reset the rate limiter to initial state
   */
  reset(): void {
    this.tokens = this.config.maxTokens;
    this.lastRefillTime = Date.now();
    this.processingScheduled = false;
    
    // Reject all waiting requests
    const queue = [...this.waitQueue];
    this.waitQueue = [];
    queue.forEach(({ reject }) => {
      reject(new RateLimiterError('Rate limiter was reset'));
    });
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    
    if (timePassed >= this.config.refillRateMs) {
      const tokensToAdd = Math.floor(timePassed / this.config.refillRateMs);
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now - (timePassed % this.config.refillRateMs);
    }
  }

  private processQueue(): void {
    if (this.waitQueue.length === 0 || this.processingScheduled) {
      return;
    }

    this.processingScheduled = true;

    // Schedule processing after the next refill
    const timeUntilNextRefill = this.config.refillRateMs - (Date.now() - this.lastRefillTime);
    const delay = Math.max(0, timeUntilNextRefill);

    setTimeout(() => {
      this.processingScheduled = false;
      this.refillTokens();
      
      while (this.waitQueue.length > 0 && this.tokens > 0) {
        const waiter = this.waitQueue.shift()!;
        this.tokens--;
        waiter.resolve();
      }

      // Continue processing if there are still waiters
      if (this.waitQueue.length > 0) {
        this.processQueue();
      }
    }, delay);
  }
}

export class RateLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimiterError';
  }
}