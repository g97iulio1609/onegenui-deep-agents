import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryMetricsAdapter } from "../in-memory-metrics.adapter.js";

describe("InMemoryMetricsAdapter", () => {
  let metrics: InMemoryMetricsAdapter;

  beforeEach(() => {
    metrics = new InMemoryMetricsAdapter();
  });

  describe("counters", () => {
    it("should increment counter by 1 by default", () => {
      metrics.incrementCounter("requests");
      expect(metrics.getCounter("requests")).toBe(1);
    });

    it("should increment counter by specified value", () => {
      metrics.incrementCounter("requests", 5);
      expect(metrics.getCounter("requests")).toBe(5);
    });

    it("should accumulate counter values", () => {
      metrics.incrementCounter("requests");
      metrics.incrementCounter("requests", 3);
      expect(metrics.getCounter("requests")).toBe(4);
    });

    it("should support labels", () => {
      metrics.incrementCounter("requests", 1, { method: "GET" });
      metrics.incrementCounter("requests", 2, { method: "POST" });
      expect(metrics.getCounter("requests", { method: "GET" })).toBe(1);
      expect(metrics.getCounter("requests", { method: "POST" })).toBe(2);
    });

    it("should return 0 for unknown counter", () => {
      expect(metrics.getCounter("unknown")).toBe(0);
    });
  });

  describe("histograms", () => {
    it("should record histogram values", () => {
      metrics.recordHistogram("latency", 100);
      metrics.recordHistogram("latency", 200);
      metrics.recordHistogram("latency", 150);
      expect(metrics.getHistogram("latency")).toEqual([100, 200, 150]);
    });

    it("should support labels", () => {
      metrics.recordHistogram("latency", 100, { endpoint: "/api" });
      metrics.recordHistogram("latency", 50, { endpoint: "/health" });
      expect(metrics.getHistogram("latency", { endpoint: "/api" })).toEqual([100]);
      expect(metrics.getHistogram("latency", { endpoint: "/health" })).toEqual([50]);
    });

    it("should return empty array for unknown histogram", () => {
      expect(metrics.getHistogram("unknown")).toEqual([]);
    });
  });

  describe("gauges", () => {
    it("should record gauge value", () => {
      metrics.recordGauge("temperature", 72);
      expect(metrics.getGauge("temperature")).toBe(72);
    });

    it("should overwrite previous gauge value", () => {
      metrics.recordGauge("temperature", 72);
      metrics.recordGauge("temperature", 68);
      expect(metrics.getGauge("temperature")).toBe(68);
    });

    it("should support labels", () => {
      metrics.recordGauge("connections", 10, { pool: "main" });
      metrics.recordGauge("connections", 5, { pool: "secondary" });
      expect(metrics.getGauge("connections", { pool: "main" })).toBe(10);
      expect(metrics.getGauge("connections", { pool: "secondary" })).toBe(5);
    });

    it("should return undefined for unknown gauge", () => {
      expect(metrics.getGauge("unknown")).toBeUndefined();
    });
  });

  it("should clear all metrics", () => {
    metrics.incrementCounter("c");
    metrics.recordHistogram("h", 1);
    metrics.recordGauge("g", 1);
    metrics.clear();
    expect(metrics.getCounter("c")).toBe(0);
    expect(metrics.getHistogram("h")).toEqual([]);
    expect(metrics.getGauge("g")).toBeUndefined();
  });
});
