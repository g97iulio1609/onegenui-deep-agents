/**
 * Policy evaluator functions extracted from routing-policy.ts.
 *
 * Contains: enforcement helpers, routing resolution, explain/diff/gate/rollout evaluators.
 */
import type { ProviderType } from "./types.js";
import type {
  GovernanceRule,
  PolicyDiffResult,
  PolicyDiffSummary,
  PolicyGateScenario,
  PolicyGateSummary,
  PolicyRolloutCheck,
  PolicyRolloutGateResult,
  PolicyRolloutGuardrails,
  ResolvedRoutingTarget,
  ResolveRoutingTargetOptions,
  RoutingCandidate,
  RoutingDecisionExplanation,
  RoutingExplainCheck,
  RoutingExplainCheckName,
  RoutingPolicy,
} from "./routing-policy.js";

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

export function enforceRoutingTimeWindow(
  policy: RoutingPolicy | undefined,
  hourUtc: number,
): void {
  const allowedHours = policy?.allowedHoursUtc;
  if (!allowedHours || allowedHours.length === 0) return;
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23 || !allowedHours.includes(hourUtc)) {
    throw new Error(`routing policy rejected hour ${hourUtc}`);
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
  const currentHourUtc = options.currentHourUtc ?? new Date().getUTCHours();
  enforceRoutingTimeWindow(policy, currentHourUtc);
  if (options.estimatedCostUsd !== undefined) {
    enforceRoutingCostLimit(policy, options.estimatedCostUsd);
  }
  if (options.currentRequestsPerMinute !== undefined) {
    enforceRoutingRateLimit(policy, options.currentRequestsPerMinute);
  }

  const pickCandidate = (candidates: RoutingCandidate[]): RoutingCandidate => {
    if (candidates.length === 1) return candidates[0];
    return [...candidates].sort((a, b) => {
      const bWeight = policy?.providerWeights?.[b.provider] ?? 0;
      const aWeight = policy?.providerWeights?.[a.provider] ?? 0;
      if (bWeight !== aWeight) return bWeight - aWeight;
      return (b.priority ?? 0) - (a.priority ?? 0);
    })[0];
  };

  const candidates = policy?.aliases?.[model];
  if (candidates && candidates.length > 0) {
    const sorted = [...candidates].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const availableProviders = options.availableProviders;
    if (!availableProviders || availableProviders.length === 0) {
      const selected = pickCandidate(sorted);
      enforceRoutingGovernance(policy, selected.provider, governanceTags);
      return {
        provider: selected.provider,
        model: selected.model,
        selectedBy: `alias:${model}`,
      };
    }
    const available = new Set(availableProviders);
    const availableCandidates = sorted.filter((candidate) => available.has(candidate.provider));
    if (availableCandidates.length > 0) {
      const selected = pickCandidate(availableCandidates);
      enforceRoutingGovernance(policy, selected.provider, governanceTags);
      return {
        provider: selected.provider,
        model: selected.model,
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

export function explainRoutingTarget(
  policy: RoutingPolicy | undefined,
  provider: ProviderType,
  model: string,
  options: ResolveRoutingTargetOptions = {},
): RoutingDecisionExplanation {
  const checks: RoutingExplainCheck[] = [];
  const hour = options.currentHourUtc ?? new Date().getUTCHours();
  const fail = (check: RoutingExplainCheckName, error: unknown): RoutingDecisionExplanation => {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ check, status: "failed", detail: message });
    return { ok: false, checks, error: message };
  };

  if (policy?.allowedHoursUtc && policy.allowedHoursUtc.length > 0) {
    try {
      enforceRoutingTimeWindow(policy, hour);
      checks.push({ check: "time_window", status: "passed", detail: `hour=${hour}` });
    } catch (error) {
      return fail("time_window", error);
    }
  } else {
    checks.push({ check: "time_window", status: "skipped", detail: "not configured" });
  }

  if (options.estimatedCostUsd !== undefined) {
    try {
      enforceRoutingCostLimit(policy, options.estimatedCostUsd);
      checks.push({ check: "cost_limit", status: "passed", detail: `cost=${options.estimatedCostUsd}` });
    } catch (error) {
      return fail("cost_limit", error);
    }
  } else {
    checks.push({ check: "cost_limit", status: "skipped", detail: "no estimate provided" });
  }

  if (options.currentRequestsPerMinute !== undefined) {
    try {
      enforceRoutingRateLimit(policy, options.currentRequestsPerMinute);
      checks.push({
        check: "rate_limit",
        status: "passed",
        detail: `rpm=${options.currentRequestsPerMinute}`,
      });
    } catch (error) {
      return fail("rate_limit", error);
    }
  } else {
    checks.push({ check: "rate_limit", status: "skipped", detail: "no rpm provided" });
  }

  try {
    const decision = resolveRoutingTarget(policy, provider, model, options);
    checks.push({ check: "governance", status: "passed", detail: "accepted" });
    checks.push({ check: "selection", status: "passed", detail: decision.selectedBy });
    return { ok: true, decision, checks };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("governance")) {
      checks.push({ check: "governance", status: "failed", detail: message });
      checks.push({ check: "selection", status: "skipped", detail: "selection aborted" });
      return { ok: false, checks, error: message };
    }
    return fail("selection", error);
  }
}

export function evaluatePolicyGate(
  policy: RoutingPolicy | undefined,
  scenarios: PolicyGateScenario[],
): PolicyGateSummary {
  const results = scenarios.map((scenario) =>
    explainRoutingTarget(
      policy,
      scenario.provider,
      scenario.model,
      scenario.options ?? {},
    ));
  const failedIndexes = results
    .map((result, index) => ({ result, index }))
    .filter((item) => !item.result.ok)
    .map((item) => item.index);
  const failed = failedIndexes.length;
  return {
    total: results.length,
    passed: results.length - failed,
    failed,
    failedIndexes,
    results,
  };
}

export function evaluatePolicyDiff(
  candidatePolicy: RoutingPolicy | undefined,
  scenarios: PolicyGateScenario[],
  baselinePolicy: RoutingPolicy | undefined = undefined,
): PolicyDiffSummary {
  const results = scenarios.map((scenario, index) => {
    const baseline = explainRoutingTarget(
      baselinePolicy,
      scenario.provider,
      scenario.model,
      scenario.options ?? {},
    );
    const candidate = explainRoutingTarget(
      candidatePolicy,
      scenario.provider,
      scenario.model,
      scenario.options ?? {},
    );
    const changed = baseline.ok !== candidate.ok
      || baseline.decision?.provider !== candidate.decision?.provider
      || baseline.decision?.model !== candidate.decision?.model
      || baseline.decision?.selectedBy !== candidate.decision?.selectedBy
      || baseline.error !== candidate.error;
    return {
      index,
      input: { provider: scenario.provider, model: scenario.model },
      baseline,
      candidate,
      changed,
    };
  });
  const regressions = results.filter((item) => item.baseline.ok && !item.candidate.ok).length;
  return {
    total: results.length,
    baselinePassed: results.filter((item) => item.baseline.ok).length,
    candidatePassed: results.filter((item) => item.candidate.ok).length,
    changed: results.filter((item) => item.changed).length,
    regressions,
    results,
  };
}

export function evaluatePolicyRolloutGuardrails(
  diff: PolicyDiffSummary,
  guardrails: PolicyRolloutGuardrails = {},
): PolicyRolloutGateResult {
  const checks: PolicyRolloutCheck[] = [];
  const maxChanged = guardrails.maxChanged ?? diff.total;
  const maxRegressions = guardrails.maxRegressions ?? 0;
  const minCandidatePassRate = guardrails.minCandidatePassRate ?? 1;
  const candidatePassRate = diff.total === 0 ? 1 : diff.candidatePassed / diff.total;

  checks.push({
    check: "changed_budget",
    status: diff.changed <= maxChanged ? "passed" : "failed",
    detail: `changed=${diff.changed}, limit=${maxChanged}`,
  });
  checks.push({
    check: "regression_budget",
    status: diff.regressions <= maxRegressions ? "passed" : "failed",
    detail: `regressions=${diff.regressions}, limit=${maxRegressions}`,
  });
  checks.push({
    check: "candidate_pass_rate",
    status: candidatePassRate >= minCandidatePassRate ? "passed" : "failed",
    detail: `candidate_pass_rate=${candidatePassRate.toFixed(3)}, min=${minCandidatePassRate.toFixed(3)}`,
  });

  const failed = checks.find((check) => check.status === "failed");
  return failed
    ? { ok: false, checks, error: failed.detail }
    : { ok: true, checks };
}
