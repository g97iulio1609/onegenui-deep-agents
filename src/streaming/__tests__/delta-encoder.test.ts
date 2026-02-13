import { describe, it, expect } from "vitest";

import { createDeltaEncoder } from "../delta-encoder.js";
import type { AgentEvent } from "../../types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeEvent(
  type: string,
  data: unknown = {},
  overrides: Partial<AgentEvent> = {},
): AgentEvent {
  return {
    type: type as AgentEvent["type"],
    timestamp: 1000,
    sessionId: "s1",
    data,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("createDeltaEncoder", () => {
  it("first event returns full JSON", () => {
    const encoder = createDeltaEncoder();
    const event = makeEvent("agent:start", { prompt: "hi" });
    const result = encoder.encode(event);

    expect(result).toBe(JSON.stringify(event));
  });

  it("identical event returns null", () => {
    const encoder = createDeltaEncoder();
    const event = makeEvent("agent:start", { prompt: "hi" });

    encoder.encode(event); // first
    const result = encoder.encode(event); // identical

    expect(result).toBeNull();
  });

  it("changed field returns delta", () => {
    const encoder = createDeltaEncoder();
    const event1 = makeEvent("step:start", { stepIndex: 0 });
    const event2 = makeEvent("step:start", { stepIndex: 1 });

    encoder.encode(event1);
    const delta = encoder.encode(event2);

    expect(delta).not.toBeNull();
    const parsed = JSON.parse(delta!);
    expect(parsed.type).toBe("step:start");
    expect(parsed.data).toEqual({ stepIndex: 1 });
    // Unchanged fields should not appear
    expect(parsed).not.toHaveProperty("sessionId");
    expect(parsed).not.toHaveProperty("timestamp");
  });
});
