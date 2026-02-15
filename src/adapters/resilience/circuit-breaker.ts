/**
 * Circuit Breaker implementation following the classic pattern
 * States: closed → open → half-open
 */

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly monitorWindowMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  monitorWindowMs: 60_000,
};

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

interface FailureRecord {
  timestamp: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: FailureRecord[] = [];
  private lastFailureTime = 0;
  private halfOpenTestInProgress = false;

  constructor(private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.shouldReject()) {
      throw new CircuitBreakerError('Circuit breaker is OPEN');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    this.updateState();
    return this.state;
  }

  getFailureCount(): number {
    this.cleanupOldFailures();
    return this.failures.length;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = [];
    this.lastFailureTime = 0;
    this.halfOpenTestInProgress = false;
  }

  private shouldReject(): boolean {
    this.updateState();
    
    if (this.state === CircuitBreakerState.OPEN) {
      return true;
    }
    
    if (this.state === CircuitBreakerState.HALF_OPEN && this.halfOpenTestInProgress) {
      return true;
    }

    return false;
  }

  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failures = [];
      this.halfOpenTestInProgress = false;
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.failures.push({ timestamp: now });
    this.lastFailureTime = now;
    this.halfOpenTestInProgress = false;
    
    // A failure during HALF_OPEN always reopens the circuit immediately
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      return;
    }
    
    this.cleanupOldFailures();
    
    if (this.failures.length >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  private updateState(): void {
    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenTestInProgress = false;
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN && !this.halfOpenTestInProgress) {
      this.halfOpenTestInProgress = true;
    }
  }

  private cleanupOldFailures(): void {
    const now = Date.now();
    const cutoff = now - this.config.monitorWindowMs;
    this.failures = this.failures.filter(failure => failure.timestamp > cutoff);
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}