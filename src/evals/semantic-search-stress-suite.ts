export interface SemanticSearchStressSample {
  success: boolean;
  durationMs: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
  totalCostUsd: number;
}

export interface SemanticSearchStressThresholds {
  minSuccessRate: number;
  maxP95LatencyMs: number;
  minCacheHitRate: number;
  maxFallbackRate: number;
  maxAverageCostUsd: number;
}

export interface SemanticSearchStressSummary {
  samples: number;
  aggregate: {
    successRate: number;
    p95LatencyMs: number;
    cacheHitRate: number;
    fallbackRate: number;
    averageCostUsd: number;
  };
  thresholds: SemanticSearchStressThresholds;
  thresholdStatus: {
    successRate: boolean;
    p95LatencyMs: boolean;
    cacheHitRate: boolean;
    fallbackRate: boolean;
    averageCostUsd: boolean;
  };
  passed: boolean;
}

export const DEFAULT_SEMANTIC_STRESS_THRESHOLDS: SemanticSearchStressThresholds = {
  minSuccessRate: 0.98,
  maxP95LatencyMs: 2_500,
  minCacheHitRate: 0.2,
  maxFallbackRate: 0.5,
  maxAverageCostUsd: 0.02,
};

export function evaluateSemanticSearchStressSuite(
  samples: readonly SemanticSearchStressSample[],
  thresholds: Partial<SemanticSearchStressThresholds> = {},
): SemanticSearchStressSummary {
  const resolvedThresholds: SemanticSearchStressThresholds = {
    ...DEFAULT_SEMANTIC_STRESS_THRESHOLDS,
    ...thresholds,
  };

  const aggregate = {
    successRate: average(samples.map((sample) => (sample.success ? 1 : 0))),
    p95LatencyMs: percentile(
      samples.map((sample) => sample.durationMs),
      95,
    ),
    cacheHitRate: average(samples.map((sample) => (sample.cacheHit ? 1 : 0))),
    fallbackRate: average(samples.map((sample) => (sample.fallbackUsed ? 1 : 0))),
    averageCostUsd: average(samples.map((sample) => sample.totalCostUsd)),
  };

  const thresholdStatus = {
    successRate: aggregate.successRate >= resolvedThresholds.minSuccessRate,
    p95LatencyMs: aggregate.p95LatencyMs <= resolvedThresholds.maxP95LatencyMs,
    cacheHitRate: aggregate.cacheHitRate >= resolvedThresholds.minCacheHitRate,
    fallbackRate: aggregate.fallbackRate <= resolvedThresholds.maxFallbackRate,
    averageCostUsd: aggregate.averageCostUsd <= resolvedThresholds.maxAverageCostUsd,
  };

  const passed =
    thresholdStatus.successRate &&
    thresholdStatus.p95LatencyMs &&
    thresholdStatus.cacheHitRate &&
    thresholdStatus.fallbackRate &&
    thresholdStatus.averageCostUsd;

  return {
    samples: samples.length,
    aggregate,
    thresholds: resolvedThresholds,
    thresholdStatus,
    passed,
  };
}

export function assertSemanticSearchStressGate(
  summary: SemanticSearchStressSummary,
): void {
  if (summary.passed) {
    return;
  }

  const issues: string[] = [];
  if (!summary.thresholdStatus.successRate) {
    issues.push(
      `successRate ${summary.aggregate.successRate.toFixed(3)} < ${summary.thresholds.minSuccessRate}`,
    );
  }
  if (!summary.thresholdStatus.p95LatencyMs) {
    issues.push(
      `p95LatencyMs ${summary.aggregate.p95LatencyMs.toFixed(1)} > ${summary.thresholds.maxP95LatencyMs}`,
    );
  }
  if (!summary.thresholdStatus.cacheHitRate) {
    issues.push(
      `cacheHitRate ${summary.aggregate.cacheHitRate.toFixed(3)} < ${summary.thresholds.minCacheHitRate}`,
    );
  }
  if (!summary.thresholdStatus.fallbackRate) {
    issues.push(
      `fallbackRate ${summary.aggregate.fallbackRate.toFixed(3)} > ${summary.thresholds.maxFallbackRate}`,
    );
  }
  if (!summary.thresholdStatus.averageCostUsd) {
    issues.push(
      `averageCostUsd ${summary.aggregate.averageCostUsd.toFixed(6)} > ${summary.thresholds.maxAverageCostUsd}`,
    );
  }

  throw new Error(`Semantic stress gate failed: ${issues.join("; ")}`);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? 0;
}
