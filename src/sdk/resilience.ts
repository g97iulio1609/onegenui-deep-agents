/**
 * Resilience SDK — fallback providers, circuit breakers, backed by Rust core.
 */
import {
  create_fallback_provider,
  create_circuit_breaker,
  create_resilient_provider,
} from "gauss-napi";

import type { Handle } from "./types.js";
import type { Agent } from "./agent.js";

/**
 * Create a fallback provider that tries providers in order.
 * Returns a provider handle usable with Agent constructor.
 */
export function createFallbackProvider(
  providerHandles: Handle[]
): Handle {
  return create_fallback_provider(providerHandles);
}

/**
 * Wrap a provider with a circuit breaker.
 * Returns a provider handle usable with Agent constructor.
 */
export function createCircuitBreaker(
  providerHandle: Handle,
  failureThreshold?: number,
  recoveryTimeoutMs?: number
): Handle {
  return create_circuit_breaker(
    providerHandle,
    failureThreshold,
    recoveryTimeoutMs
  );
}

/**
 * Create a resilient provider with retry, circuit breaker, and fallbacks.
 * Returns a provider handle usable with Agent constructor.
 */
export function createResilientProvider(
  primaryHandle: Handle,
  fallbackHandles: Handle[],
  enableCircuitBreaker?: boolean
): Handle {
  return create_resilient_provider(
    primaryHandle,
    fallbackHandles,
    enableCircuitBreaker
  );
}

/**
 * Convenience: create a resilient agent by wrapping its provider.
 */
export function createResilientAgent(
  primary: Agent,
  fallbacks: Agent[],
  enableCircuitBreaker = true
): Handle {
  return createResilientProvider(
    primary.handle,
    fallbacks.map((a) => a.handle),
    enableCircuitBreaker
  );
}
