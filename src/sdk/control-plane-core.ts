/**
 * Control Plane — Core types, interfaces, and domain constants.
 *
 * Extracted from control-plane.ts for modularity.
 */
import type { estimateCost } from "./tokens.js";
import type { Telemetry } from "./telemetry.js";
import type { ApprovalManager } from "./approval.js";
import type { ProviderType } from "./types.js";
import type {
  PolicyGateSummary,
  PolicyRolloutGuardrails,
  PolicyRolloutGateResult,
  PolicyDiffSummary,
  RoutingPolicy,
  RoutingDecisionExplanation,
} from "./routing-policy.js";

// ── Error ──────────────────────────────────────────────────────────

export class ControlPlaneForbiddenError extends Error {}

// ── Constants ──────────────────────────────────────────────────────

export const PROVIDER_VALUES: ProviderType[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "ollama",
  "deepseek",
  "openrouter",
  "together",
  "fireworks",
  "mistral",
  "perplexity",
  "xai",
];

// ── Public Interfaces ──────────────────────────────────────────────

export interface ControlPlaneUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface ControlPlaneSnapshot {
  generatedAt: string;
  context: ControlPlaneContext;
  spans: unknown;
  metrics: unknown;
  pendingApprovals: unknown;
  latestCost: ReturnType<typeof estimateCost> | null;
  latestExplainTraceId: string | null;
}

export type ControlPlaneSection = "spans" | "metrics" | "pendingApprovals" | "latestCost";

export interface ControlPlaneContext {
  tenantId?: string;
  sessionId?: string;
  runId?: string;
}

export interface ControlPlaneAuthClaims {
  tenantId?: string;
  allowedSessionIds?: string[];
  allowedRunIds?: string[];
  roles?: string[];
}

export interface ControlPlaneOptions {
  telemetry?: Pick<Telemetry, "exportSpans" | "exportMetrics">;
  approvals?: Pick<ApprovalManager, "listPending">;
  model?: string;
  routingPolicy?: RoutingPolicy;
  authToken?: string;
  authClaims?: ControlPlaneAuthClaims;
  persistPath?: string;
  historyLimit?: number;
  streamReplayLimit?: number;
  context?: ControlPlaneContext;
}

export interface ControlPlaneTimelinePoint {
  generatedAt: string;
  spanCount: number;
  pendingApprovalsCount: number;
  totalCostUsd: number;
  latestExplainTraceId?: string | null;
}

export type ControlPlaneStreamChannel = "snapshot" | "timeline" | "dag";

export interface ControlPlaneStreamEvent {
  id: number;
  event: ControlPlaneStreamChannel;
  generatedAt: string;
  context: ControlPlaneContext;
  payload: unknown;
}

export interface ControlPlaneOpsCapabilities {
  sections: ControlPlaneSection[];
  channels: ControlPlaneStreamChannel[];
  supportsMultiplex: boolean;
  supportsReplayCursor: boolean;
  supportsChannelRbac: boolean;
  supportsOpsSummary: boolean;
  supportsOpsTenants: boolean;
  supportsPolicyExplain: boolean;
  supportsPolicyExplainBatch: boolean;
  supportsPolicyExplainTraces: boolean;
  supportsPolicyExplainDiff: boolean;
  supportsPolicyLifecycle: boolean;
  supportsPolicyLifecycleRbac: boolean;
  supportsPolicyDriftMonitoring: boolean;
  supportsPolicyDriftScheduler: boolean;
  supportsPolicyDriftWindows: boolean;
  supportsPolicyDriftAlertSinks: boolean;
  hostedDashboardPath: string;
  hostedTenantDashboardPath: string;
  policyExplainPath: string;
  policyExplainBatchPath: string;
  policyExplainSimulatePath: string;
  policyExplainTracePath: string;
  policyExplainDiffPath: string;
  policyLifecycleBasePath: string;
  policyLifecycleRoleParam: string;
  policyLifecycleAuditFields: string[];
  policyDriftPath: string;
  policyDriftSchedulePath: string;
  policyDriftScheduleRunPath: string;
}

export interface ControlPlaneOpsHealth {
  status: "ok";
  generatedAt: string;
  historySize: number;
  streamBufferSize: number;
}

export interface ControlPlaneOpsSummary {
  status: "ok";
  generatedAt: string;
  historySize: number;
  streamBufferSize: number;
  spansCount: number;
  pendingApprovalsCount: number;
  latestTotalCostUsd: number;
  tenantCount: number;
  sessionCount: number;
  runCount: number;
}

export interface ControlPlaneOpsTenantSummary {
  tenantId: string;
  snapshotCount: number;
  spansCount: number;
  pendingApprovalsCount: number;
  latestTotalCostUsd: number;
  sessionCount: number;
  runCount: number;
  latestGeneratedAt: string;
}

export interface ControlPlanePolicyExplainTrace {
  traceId: string;
  generatedAt: string;
  mode: "single" | "batch" | "simulate" | "diff" | "drift";
  payload: unknown;
}

export interface ControlPlanePolicyDriftAlert {
  ok: boolean;
  alert: boolean;
  generatedAt: string;
  window: ControlPlanePolicyDriftWindow;
  baselineVersionId: string | null;
  candidateVersionId: string | null;
  diff: PolicyDiffSummary;
  guardrails: PolicyRolloutGateResult;
  sinksTriggered: string[];
}

export type ControlPlanePolicyDriftWindow = "custom" | "last_1h" | "last_24h" | "last_7d";

// ── Internal Interfaces ────────────────────────────────────────────

export type ControlPlanePolicyLifecycleStatus = "draft" | "validated" | "approved" | "promoted";

export interface ControlPlanePolicyLifecycleAudit {
  draftedByRole?: string;
  draftedBy?: string;
  draftComment?: string;
  validatedByRole?: string;
  validatedBy?: string;
  validationComment?: string;
  approvedByRole?: string;
  approvedBy?: string;
  approvalComment?: string;
  promotedByRole?: string;
  promotedBy?: string;
  promotionComment?: string;
}

export interface ControlPlanePolicyLifecycleVersion {
  versionId: string;
  status: ControlPlanePolicyLifecycleStatus;
  createdAt: string;
  validatedAt?: string;
  approvedAt?: string;
  promotedAt?: string;
  policy: RoutingPolicy;
  validation?: PolicyGateSummary;
  audit?: ControlPlanePolicyLifecycleAudit;
}

export interface ControlPlanePolicyDriftScheduleConfig {
  enabled: boolean;
  intervalMs: number;
  window: ControlPlanePolicyDriftWindow;
  scenariosRaw: string;
  baselinePolicyRaw?: string;
  candidatePolicyRaw?: string;
  baselineVersionId?: string;
  candidateVersionId?: string;
  guardrails: PolicyRolloutGuardrails;
  updatedAt: string;
  lastRunAt?: string;
}

export interface ControlPlanePolicyDriftScheduleRun extends ControlPlanePolicyDriftAlert {
  runId: string;
  traceId: string;
}
