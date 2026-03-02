import type { ProviderType } from "./types.js";

export interface RoutingCandidate {
  provider: ProviderType;
  model: string;
  priority?: number;
  maxCostUsd?: number;
}

export type GovernanceRule =
  | { type: "require_tag"; tag: string }
  | { type: "deny_provider"; provider: ProviderType }
  | { type: "allow_provider"; provider: ProviderType };

export interface GovernancePolicyPack {
  rules: GovernanceRule[];
}

export type GovernancePackName = "enterprise-strict" | "eu-residency" | "cost-guarded";

export interface RoutingPolicy {
  aliases?: Record<string, RoutingCandidate[]>;
  fallbackOrder?: ProviderType[];
  maxTotalCostUsd?: number;
  maxRequestsPerMinute?: number;
  governance?: GovernancePolicyPack;
}

export interface ResolvedRoutingTarget {
  provider: ProviderType;
  model: string;
  selectedBy: "direct" | `alias:${string}` | `fallback:${ProviderType}`;
}

export interface ResolveRoutingTargetOptions {
  availableProviders?: ProviderType[];
  estimatedCostUsd?: number;
  currentRequestsPerMinute?: number;
  governanceTags?: string[];
}

export function governancePolicyPack(name: GovernancePackName): GovernancePolicyPack {
  switch (name) {
    case "enterprise-strict":
      return {
        rules: [
          { type: "allow_provider", provider: "openai" },
          { type: "allow_provider", provider: "anthropic" },
          { type: "require_tag", tag: "pci" },
        ],
      };
    case "eu-residency":
      return {
        rules: [
          { type: "deny_provider", provider: "xai" },
          { type: "require_tag", tag: "eu" },
        ],
      };
    case "cost-guarded":
      return {
        rules: [
          { type: "allow_provider", provider: "openai" },
          { type: "allow_provider", provider: "deepseek" },
          { type: "require_tag", tag: "cost-sensitive" },
        ],
      };
  }
}

export function applyGovernancePack(
  policy: RoutingPolicy | undefined,
  packName: GovernancePackName,
): RoutingPolicy {
  const pack = governancePolicyPack(packName);
  const existingRules = policy?.governance?.rules ?? [];
  return {
    ...policy,
    governance: {
      rules: [...existingRules, ...pack.rules],
    },
  };
}

export function enforceRoutingCostLimit(
  policy: RoutingPolicy | undefined,
  costUsd: number,
): void {
  if (policy?.maxTotalCostUsd !== undefined && costUsd > policy.maxTotalCostUsd) {
    throw new Error(`routing policy rejected cost ${costUsd}`);
  }
}

export function enforceRoutingRateLimit(
  policy: RoutingPolicy | undefined,
  requestsPerMinute: number,
): void {
  if (
    policy?.maxRequestsPerMinute !== undefined &&
    requestsPerMinute > policy.maxRequestsPerMinute
  ) {
    throw new Error(`routing policy rejected rate ${requestsPerMinute}`);
  }
}

export function enforceRoutingGovernance(
  policy: RoutingPolicy | undefined,
  provider: ProviderType,
  tags?: string[],
): void {
  const rules = policy?.governance?.rules ?? [];
  if (rules.length === 0) return;
  const allow = rules
    .filter((rule): rule is Extract<GovernanceRule, { type: "allow_provider" }> => rule.type === "allow_provider")
    .map((rule) => rule.provider);
  if (allow.length > 0 && !allow.includes(provider)) {
    throw new Error(`routing policy governance rejected provider ${provider}`);
  }
  for (const rule of rules) {
    if (rule.type === "deny_provider" && rule.provider === provider) {
      throw new Error(`routing policy governance rejected provider ${provider}`);
    }
    if (rule.type === "require_tag" && tags !== undefined && !tags.includes(rule.tag)) {
      throw new Error(`routing policy governance missing tag ${rule.tag}`);
    }
  }
}

export function resolveFallbackProvider(
  policy: RoutingPolicy | undefined,
  availableProviders: ProviderType[],
): ProviderType | null {
  const order = policy?.fallbackOrder;
  if (!order || order.length === 0 || availableProviders.length === 0) {
    return null;
  }
  const available = new Set(availableProviders);
  for (const candidate of order) {
    if (available.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolveRoutingTarget(
  policy: RoutingPolicy | undefined,
  provider: ProviderType,
  model: string,
  options: ResolveRoutingTargetOptions = {},
): ResolvedRoutingTarget {
  const governanceTags = options.governanceTags;
  if (options.estimatedCostUsd !== undefined) {
    enforceRoutingCostLimit(policy, options.estimatedCostUsd);
  }
  if (options.currentRequestsPerMinute !== undefined) {
    enforceRoutingRateLimit(policy, options.currentRequestsPerMinute);
  }

  const candidates = policy?.aliases?.[model];
  if (candidates && candidates.length > 0) {
    const sorted = [...candidates].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const availableProviders = options.availableProviders;
    if (!availableProviders || availableProviders.length === 0) {
      enforceRoutingGovernance(policy, sorted[0].provider, governanceTags);
      return {
        provider: sorted[0].provider,
        model: sorted[0].model,
        selectedBy: `alias:${model}`,
      };
    }
    const available = new Set(availableProviders);
    const availableCandidate = sorted.find((candidate) => available.has(candidate.provider));
    if (availableCandidate) {
      enforceRoutingGovernance(policy, availableCandidate.provider, governanceTags);
      return {
        provider: availableCandidate.provider,
        model: availableCandidate.model,
        selectedBy: `alias:${model}`,
      };
    }
  }

  const fallback = resolveFallbackProvider(policy, options.availableProviders ?? []);
  if (fallback && fallback !== provider) {
    enforceRoutingGovernance(policy, fallback, governanceTags);
    return { provider: fallback, model, selectedBy: `fallback:${fallback}` };
  }

  enforceRoutingGovernance(policy, provider, governanceTags);
  return { provider, model, selectedBy: "direct" };
}
