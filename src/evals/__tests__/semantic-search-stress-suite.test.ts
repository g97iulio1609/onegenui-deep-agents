import { describe, expect, it } from "vitest";

import {
  assertSemanticSearchStressGate,
  evaluateSemanticSearchStressSuite,
} from "../semantic-search-stress-suite.js";

describe("semantic-search-stress-suite", () => {
  it("passes when operational metrics are within thresholds", () => {
    const summary = evaluateSemanticSearchStressSuite(
      [
        {
          success: true,
          durationMs: 120,
          cacheHit: false,
          fallbackUsed: false,
          totalCostUsd: 0.001,
        },
        {
          success: true,
          durationMs: 90,
          cacheHit: true,
          fallbackUsed: false,
          totalCostUsd: 0.0006,
        },
        {
          success: true,
          durationMs: 110,
          cacheHit: true,
          fallbackUsed: false,
          totalCostUsd: 0.0008,
        },
      ],
      {
        minSuccessRate: 1,
        maxP95LatencyMs: 200,
        minCacheHitRate: 0.3,
        maxFallbackRate: 0.2,
        maxAverageCostUsd: 0.002,
      },
    );

    expect(summary.passed).toBe(true);
    expect(() => assertSemanticSearchStressGate(summary)).not.toThrow();
  });

  it("fails when stress metrics regress beyond thresholds", () => {
    const summary = evaluateSemanticSearchStressSuite(
      [
        {
          success: false,
          durationMs: 5_000,
          cacheHit: false,
          fallbackUsed: true,
          totalCostUsd: 0.05,
        },
      ],
      {
        minSuccessRate: 0.9,
        maxP95LatencyMs: 500,
        minCacheHitRate: 0.2,
        maxFallbackRate: 0.2,
        maxAverageCostUsd: 0.01,
      },
    );

    expect(summary.passed).toBe(false);
    expect(() => assertSemanticSearchStressGate(summary)).toThrow(
      "Semantic stress gate failed",
    );
  });
});
