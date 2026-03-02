import { describe, it, expect } from "vitest";

import {
  applyGovernancePack,
  evaluatePolicyGate,
  explainRoutingTarget,
  enforceRoutingCostLimit,
  enforceRoutingGovernance,
  enforceRoutingRateLimit,
  enforceRoutingTimeWindow,
  governancePolicyPack,
  resolveFallbackProvider,
  resolveRoutingTarget,
} from "../routing-policy.js";

describe("routing-policy helpers", () => {
  it("resolves alias candidates by priority", () => {
    const resolved = resolveRoutingTarget(
      {
        aliases: {
          "fast-chat": [
            { provider: "openai", model: "gpt-4o-mini", priority: 1 },
            { provider: "anthropic", model: "claude-3-5-haiku-latest", priority: 10 },
          ],
        },
      },
      "openai",
      "fast-chat",
    );
    expect(resolved.provider).toBe("anthropic");
    expect(resolved.model).toBe("claude-3-5-haiku-latest");
    expect(resolved.selectedBy).toBe("alias:fast-chat");
  });

  it("resolves alias candidates by priority among available providers", () => {
    const resolved = resolveRoutingTarget(
      {
        aliases: {
          "fast-chat": [
            { provider: "openai", model: "gpt-4o-mini", priority: 1 },
            { provider: "anthropic", model: "claude-3-5-haiku-latest", priority: 10 },
          ],
        },
      },
      "openai",
      "fast-chat",
      { availableProviders: ["openai"] },
    );
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-4o-mini");
    expect(resolved.selectedBy).toBe("alias:fast-chat");
  });

  it("resolves fallback provider when primary is unavailable", () => {
    const fallback = resolveFallbackProvider(
      { fallbackOrder: ["anthropic", "openai"] },
      ["openai"],
    );
    expect(fallback).toBe("openai");

    const resolved = resolveRoutingTarget(
      { fallbackOrder: ["anthropic", "openai"] },
      "google",
      "gpt-5.2",
      { availableProviders: ["openai"] },
    );
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-5.2");
    expect(resolved.selectedBy).toBe("fallback:openai");
  });

  it("enforces policy cost limit", () => {
    expect(() => enforceRoutingCostLimit({ maxTotalCostUsd: 1 }, 1.5)).toThrow(
      "routing policy rejected cost 1.5",
    );
    expect(() => enforceRoutingCostLimit({ maxTotalCostUsd: 2 }, 1.5)).not.toThrow();
  });

  it("enforces policy rate limit", () => {
    expect(() => enforceRoutingRateLimit({ maxRequestsPerMinute: 10 }, 11)).toThrow(
      "routing policy rejected rate 11",
    );
    expect(() => enforceRoutingRateLimit({ maxRequestsPerMinute: 10 }, 10)).not.toThrow();
  });

  it("enforces policy UTC time window", () => {
    expect(() => enforceRoutingTimeWindow({ allowedHoursUtc: [9, 10, 11] }, 10)).not.toThrow();
    expect(() => enforceRoutingTimeWindow({ allowedHoursUtc: [9, 10, 11] }, 20)).toThrow(
      "routing policy rejected hour 20",
    );
  });

  it("enforces governance provider and required tags", () => {
    const policy = {
      governance: {
        rules: [
          { type: "allow_provider" as const, provider: "openai" as const },
          { type: "require_tag" as const, tag: "pci" },
        ],
      },
    };

    expect(() => enforceRoutingGovernance(policy, "openai", ["pci"])).not.toThrow();
    expect(() => enforceRoutingGovernance(policy, "anthropic", ["pci"])).toThrow(
      "routing policy governance rejected provider anthropic",
    );
    expect(() => enforceRoutingGovernance(policy, "openai", [])).toThrow(
      "routing policy governance missing tag pci",
    );
  });

  it("applies governance rules during route resolution", () => {
    expect(() =>
      resolveRoutingTarget(
        {
          governance: {
            rules: [{ type: "deny_provider", provider: "openai" }],
          },
        },
        "openai",
        "gpt-5.2",
      ),
    ).toThrow("routing policy governance rejected provider openai");
  });

  it("provides governance policy packs and can apply them", () => {
    const pack = governancePolicyPack("enterprise-strict");
    expect(pack.rules.some((rule) => rule.type === "require_tag" && rule.tag === "pci")).toBe(true);

    const merged = applyGovernancePack(
      {
        governance: {
          rules: [{ type: "allow_provider", provider: "google" }],
        },
      },
      "cost-guarded",
    );
    expect(merged.governance?.rules.length).toBeGreaterThanOrEqual(3);
    expect(() =>
      resolveRoutingTarget(
        merged,
        "openai",
        "gpt-5.2",
        { governanceTags: ["cost-sensitive"] },
      ),
    ).not.toThrow();
  });

  it("prefers weighted providers for alias routing", () => {
    const resolved = resolveRoutingTarget(
      {
        aliases: {
          "fast-chat": [
            { provider: "openai", model: "gpt-4o-mini", priority: 1 },
            { provider: "anthropic", model: "claude-3-5-haiku-latest", priority: 10 },
          ],
        },
        providerWeights: {
          openai: 100,
          anthropic: 10,
        },
      },
      "openai",
      "fast-chat",
      { availableProviders: ["openai", "anthropic"], currentHourUtc: 12 },
    );
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-4o-mini");
  });

  it("applies M64 governance packs with time windows and provider mix", () => {
    const businessHours = applyGovernancePack(undefined, "ops-business-hours");
    expect(businessHours.allowedHoursUtc?.includes(8)).toBe(true);
    expect(businessHours.allowedHoursUtc?.includes(18)).toBe(true);

    const balanced = applyGovernancePack(undefined, "balanced-mix");
    expect(balanced.providerWeights?.openai).toBe(60);
    expect(balanced.providerWeights?.anthropic).toBe(40);
    expect(() =>
      resolveRoutingTarget(
        balanced,
        "openai",
        "gpt-5.2",
        { governanceTags: ["balanced"], currentHourUtc: 12 },
      ),
    ).not.toThrow();
  });

  it("explains successful routing decisions", () => {
    const explained = explainRoutingTarget(
      {
        aliases: {
          "fast-chat": [
            { provider: "openai", model: "gpt-4o-mini", priority: 1 },
            { provider: "anthropic", model: "claude-3-5-haiku-latest", priority: 10 },
          ],
        },
        providerWeights: { openai: 100, anthropic: 10 },
      },
      "openai",
      "fast-chat",
      { availableProviders: ["openai", "anthropic"], currentHourUtc: 12 },
    );

    expect(explained.ok).toBe(true);
    expect(explained.decision?.provider).toBe("openai");
    expect(explained.checks.some((check) => check.check === "selection" && check.status === "passed")).toBe(true);
  });

  it("explains rejected routing decisions", () => {
    const explained = explainRoutingTarget(
      { allowedHoursUtc: [9, 10, 11] },
      "openai",
      "gpt-5.2",
      { currentHourUtc: 20 },
    );

    expect(explained.ok).toBe(false);
    expect(explained.error).toContain("routing policy rejected hour 20");
    expect(explained.checks.some((check) => check.check === "time_window" && check.status === "failed")).toBe(true);
  });

  it("evaluates policy gates for CI-friendly summaries", () => {
    const summary = evaluatePolicyGate(
      { allowedHoursUtc: [9, 10, 11] },
      [
        {
          provider: "openai",
          model: "gpt-5.2",
          options: { currentHourUtc: 10 },
        },
        {
          provider: "openai",
          model: "gpt-5.2",
          options: { currentHourUtc: 22 },
        },
      ],
    );
    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.failedIndexes).toEqual([1]);
  });
});
