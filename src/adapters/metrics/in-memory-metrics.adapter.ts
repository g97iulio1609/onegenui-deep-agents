// =============================================================================
// InMemoryMetricsAdapter — In-memory implementation of MetricsPort for testing
// =============================================================================

import type { MetricsPort } from "../../ports/metrics.port.js";

function labelKey(name: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return `${name}{${sorted.map(([k, v]) => `${k}="${v}"`).join(",")}}`;
}

export class InMemoryMetricsAdapter implements MetricsPort {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();
  private readonly gauges = new Map<string, number>();

  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    const key = labelKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = labelKey(name, labels);
    const arr = this.histograms.get(key) ?? [];
    arr.push(value);
    this.histograms.set(key, arr);
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = labelKey(name, labels);
    this.gauges.set(key, value);
  }

  /** Get current counter value */
  getCounter(name: string, labels?: Record<string, string>): number {
    return this.counters.get(labelKey(name, labels)) ?? 0;
  }

  /** Get histogram values */
  getHistogram(name: string, labels?: Record<string, string>): readonly number[] {
    return this.histograms.get(labelKey(name, labels)) ?? [];
  }

  /** Get current gauge value */
  getGauge(name: string, labels?: Record<string, string>): number | undefined {
    return this.gauges.get(labelKey(name, labels));
  }

  /** Clear all metrics */
  clear(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}
