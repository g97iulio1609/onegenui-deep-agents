// =============================================================================
// Delta Encoder — Reduces redundancy in high-frequency event streams
// =============================================================================

import type { AgentEvent } from "../types.js";

export interface DeltaEncoder {
  /** Encode an event, returning null if identical to previous of same type. */
  encode(event: AgentEvent): string | null;
  /** Reset all tracked state. */
  reset(): void;
}

export function createDeltaEncoder(): DeltaEncoder {
  const lastSeen = new Map<string, string>();

  return {
    encode(event: AgentEvent): string | null {
      const serialized = JSON.stringify(event);
      const prev = lastSeen.get(event.type);

      if (prev === serialized) return null;

      lastSeen.set(event.type, serialized);

      if (prev === undefined) return serialized;

      // Delta: only changed fields
      const prevObj = JSON.parse(prev) as Record<string, unknown>;
      const delta: Record<string, unknown> = { type: event.type };
      for (const key of Object.keys(event) as (keyof AgentEvent)[]) {
        if (JSON.stringify(event[key]) !== JSON.stringify(prevObj[key])) {
          delta[key] = event[key];
        }
      }
      return JSON.stringify(delta);
    },

    reset(): void {
      lastSeen.clear();
    },
  };
}
