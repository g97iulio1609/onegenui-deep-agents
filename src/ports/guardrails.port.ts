// =============================================================================
// GuardrailsPort — Input/Output safety layer for agent content validation
// =============================================================================

export type GuardrailStage = "input" | "output";
export type GuardrailAction = "block" | "warn" | "redact" | "transform" | "pass";

export interface GuardrailContext {
  agentId?: string;
  conversationId?: string;
  previousMessages?: string[];
  metadata?: Record<string, unknown>;
}

export interface GuardrailCheckResult {
  action: GuardrailAction;
  /** Confidence score between 0 and 1 */
  confidence: number;
  reason?: string;
  details?: Record<string, unknown>;
  /** Present when action is 'transform' or 'redact' */
  transformedContent?: string;
}

export interface Guardrail {
  id: string;
  name: string;
  stage: GuardrailStage | "both";
  priority: number;
  check(
    content: string,
    context?: GuardrailContext,
  ): Promise<GuardrailCheckResult>;
}

export interface GuardrailResult {
  allowed: boolean;
  finalContent: string;
  checks: Array<{
    guardrailId: string;
    guardrailName: string;
    result: GuardrailCheckResult;
  }>;
  blockedBy?: string;
}

export interface GuardrailsPort {
  addGuardrail(guardrail: Guardrail): void;
  removeGuardrail(id: string): void;
  check(
    content: string,
    stage: GuardrailStage,
    context?: GuardrailContext,
  ): Promise<GuardrailResult>;
  listGuardrails(stage?: GuardrailStage): Guardrail[];
}
