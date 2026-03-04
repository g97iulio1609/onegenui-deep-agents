import type { ProviderType } from "./types.js";

// Re-export evaluator functions from the extracted module
export {
  enforceRoutingCostLimit,
  enforceRoutingRateLimit,
  enforceRoutingTimeWindow,
  enforceRoutingGovernance,
  resolveFallbackProvider,
  resolveRoutingTarget,
  explainRoutingTarget,
  evaluatePolicyGate,
  evaluatePolicyDiff,
  evaluatePolicyRolloutGuardrails,
} from "./policy-evaluators.js";

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
  maxTotalCostUsd?: number;
  maxRequestsPerMinute?: number;
  allowedHoursUtc?: number[];
  providerWeights?: Partial<Record<ProviderType, number>>;
  fallbackOrder?: ProviderType[];
}

export type GovernancePackName =
  | "enterprise-strict"
  | "eu-residency"
  | "cost-guarded"
  | "ops-business-hours"
  | "balanced-mix"
  | "rollout-canary"
  | "rollout-strict";

export interface RoutingPolicy {
  aliases?: Record<string, RoutingCandidate[]>;
  fallbackOrder?: ProviderType[];
  maxTotalCostUsd?: number;
  maxRequestsPerMinute?: number;
  allowedHoursUtc?: number[];
  providerWeights?: Partial<Record<ProviderType, number>>;
  governance?: GovernancePolicyPack;
}

export interface ResolvedRoutingTarget {
  provider: ProviderType;
  model: string;
  selectedBy: "direct" | `alias:${string}` | `fallback:${ProviderType}`;
}

export type RoutingExplainCheckName =
  | "time_window"
  | "cost_limit"
  | "rate_limit"
  | "governance"
  | "selection";

export interface RoutingExplainCheck {
  check: RoutingExplainCheckName;
  status: "passed" | "failed" | "skipped";
  detail: string;
}

export interface RoutingDecisionExplanation {
  ok: boolean;
  decision?: ResolvedRoutingTarget;
  checks: RoutingExplainCheck[];
  error?: string;
}

export interface PolicyGateScenario {
  provider: ProviderType;
  model: string;
  options?: ResolveRoutingTargetOptions;
}

export interface PolicyGateSummary {
  total: number;
  passed: number;
  failed: number;
  failedIndexes: number[];
  results: RoutingDecisionExplanation[];
}

export interface PolicyDiffResult {
  index: number;
  input: { provider: ProviderType; model: string };
  baseline: RoutingDecisionExplanation;
  candidate: RoutingDecisionExplanation;
  changed: boolean;
}

export interface PolicyDiffSummary {
  total: number;
  baselinePassed: number;
  candidatePassed: number;
  changed: number;
  regressions: number;
  results: PolicyDiffResult[];
}

export interface PolicyRolloutGuardrails {
  maxChanged?: number;
  maxRegressions?: number;
  minCandidatePassRate?: number;
}

export type PolicyRolloutCheckName =
  | "changed_budget"
  | "regression_budget"
  | "candidate_pass_rate";

export interface PolicyRolloutCheck {
  check: PolicyRolloutCheckName;
  status: "passed" | "failed";
  detail: string;
}

export interface PolicyRolloutGateResult {
  ok: boolean;
  checks: PolicyRolloutCheck[];
  error?: string;
}

export interface ResolveRoutingTargetOptions {
  availableProviders?: ProviderType[];
  estimatedCostUsd?: number;
  currentRequestsPerMinute?: number;
  currentHourUtc?: number;
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
        maxTotalCostUsd: 0.15,
      };
    case "ops-business-hours":
      return {
        rules: [{ type: "require_tag", tag: "ops" }],
        allowedHoursUtc: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      };
    case "balanced-mix":
      return {
        rules: [
          { type: "allow_provider", provider: "openai" },
          { type: "allow_provider", provider: "anthropic" },
          { type: "require_tag", tag: "balanced" },
        ],
        providerWeights: { openai: 60, anthropic: 40 },
      };
    case "rollout-canary":
      return {
        rules: [
          { type: "allow_provider", provider: "openai" },
          { type: "allow_provider", provider: "anthropic" },
          { type: "require_tag", tag: "rollout" },
        ],
        maxTotalCostUsd: 0.1,
        maxRequestsPerMinute: 30,
        fallbackOrder: ["openai", "anthropic"],
        providerWeights: { openai: 70, anthropic: 30 },
      };
    case "rollout-strict":
      return {
        rules: [
          { type: "allow_provider", provider: "openai" },
          { type: "allow_provider", provider: "anthropic" },
          { type: "require_tag", tag: "rollout" },
          { type: "require_tag", tag: "approved" },
        ],
        maxTotalCostUsd: 0.08,
        maxRequestsPerMinute: 15,
        allowedHoursUtc: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        fallbackOrder: ["openai", "anthropic"],
      };
  }
}

export function applyGovernancePack(
  policy: RoutingPolicy | undefined,
  packName: GovernancePackName,
): RoutingPolicy {
  const pack = governancePolicyPack(packName);
  const existingRules = policy?.governance?.rules ?? [];
  const mergedFallbackOrder = pack.fallbackOrder
    ? [...new Set([...(policy?.fallbackOrder ?? []), ...pack.fallbackOrder])]
    : policy?.fallbackOrder;
  const providerWeights = pack.providerWeights
    ? { ...(policy?.providerWeights ?? {}), ...pack.providerWeights }
    : policy?.providerWeights;
  return {
    ...policy,
    maxTotalCostUsd: pack.maxTotalCostUsd ?? policy?.maxTotalCostUsd,
    maxRequestsPerMinute: pack.maxRequestsPerMinute ?? policy?.maxRequestsPerMinute,
    allowedHoursUtc: pack.allowedHoursUtc ?? policy?.allowedHoursUtc,
    fallbackOrder: mergedFallbackOrder,
    providerWeights,
    governance: {
      rules: [...existingRules, ...pack.rules],
    },
  };
}


