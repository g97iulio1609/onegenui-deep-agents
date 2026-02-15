import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker, CircuitBreakerState, CircuitBreakerError, DEFAULT_CIRCUIT_BREAKER_CONFIG } from "../../../adapters/resilience/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      monitorWindowMs: 5000,
    });
  });

  describe("initial state", () => {
    it("should start in CLOSED state", () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it("should have zero failures initially", () => {
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe("successful operations", () => {
    it("should execute successful operations in CLOSED state", async () => {
      const operation = vi.fn().mockResolvedValue("success");
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe("failure handling", () => {
    it("should track failures", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      try {
        await circuitBreaker.execute(operation);
      } catch {
        // Expected failure
      }

      expect(circuitBreaker.getFailureCount()).toBe(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it("should open circuit after failure threshold", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      // Cause 3 failures to exceed threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failure
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.getFailureCount()).toBe(3);
    });

    it("should reject operations with CircuitBreakerError in OPEN state", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failure
        }
      }

      // Next operation should be rejected immediately
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        CircuitBreakerError
      );
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        "Circuit breaker is OPEN"
      );
    });
  });

  describe("recovery", () => {
    it("should transition to HALF_OPEN after reset timeout", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failure
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for reset timeout + small buffer
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it("should close circuit on successful operation in HALF_OPEN state", async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error("failure"));
      const successOperation = vi.fn().mockResolvedValue("success");

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch {
          // Expected failure
        }
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Successful operation should close the circuit
      // (Don't call getState() before execute — it consumes the half-open test slot)
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe("success");
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it("should return to OPEN on failure in HALF_OPEN state", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failure
        }
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Failure in half-open should return to open
      // (Don't call getState() before execute — it consumes the half-open test slot)
      try {
        await circuitBreaker.execute(operation);
      } catch {
        // Expected failure
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it("should return to OPEN on HALF_OPEN probe failure even when resetTimeoutMs > monitorWindowMs", async () => {
      // Bug 2 scenario: resetTimeoutMs > monitorWindowMs causes old failures to expire,
      // so a single half-open probe failure (count=1) doesn't meet threshold
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 500,
        monitorWindowMs: 100, // shorter than resetTimeout
      });

      const failOp = vi.fn().mockRejectedValue(new Error("fail"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(failOp); } catch { /* expected */ }
      }
      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for reset timeout (failures also expire since monitorWindow < resetTimeout)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Now in HALF_OPEN; a probe failure must reopen immediately
      try { await breaker.execute(failOp); } catch { /* expected */ }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe("monitor window", () => {
    it("should clean up old failures outside monitor window", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));
      
      // Create a circuit breaker with very short monitor window for testing
      const shortWindowBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        monitorWindowMs: 100,
      });

      // Cause one failure
      try {
        await shortWindowBreaker.execute(operation);
      } catch {
        // Expected failure
      }
      
      expect(shortWindowBreaker.getFailureCount()).toBe(1);

      // Wait for monitor window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check failure count - should be cleaned up
      expect(shortWindowBreaker.getFailureCount()).toBe(0);
      expect(shortWindowBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe("reset", () => {
    it("should reset circuit breaker to initial state", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failure
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe("default config", () => {
    it("should use default configuration", () => {
      const defaultBreaker = new CircuitBreaker();
      
      expect(defaultBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(defaultBreaker.getFailureCount()).toBe(0);
    });

    it("should export default config constants", () => {
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG).toEqual({
        failureThreshold: 5,
        resetTimeoutMs: 30_000,
        monitorWindowMs: 60_000,
      });
    });
  });
});