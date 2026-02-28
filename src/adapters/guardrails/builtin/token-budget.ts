import type {
  Guardrail,
  GuardrailAction,
  GuardrailCheckResult,
  GuardrailContext,
  GuardrailStage,
} from "../../../ports/guardrails.port.js";

export interface TokenBudgetOptions {
  maxTokens: number;
  action?: GuardrailAction;
  stage?: GuardrailStage | "both";
  priority?: number;
  /** Average characters per token for estimation. Default: 4 */
  charsPerToken?: number;
}

export class TokenBudget implements Guardrail {
  readonly id = "builtin:token-budget";
  readonly name = "Token Budget";
  readonly stage: GuardrailStage | "both";
  readonly priority: number;

  private readonly maxTokens: number;
  private readonly action: GuardrailAction;
  private readonly charsPerToken: number;

  constructor(options: TokenBudgetOptions) {
    this.maxTokens = options.maxTokens;
    this.action = options.action ?? "block";
    this.stage = options.stage ?? "both";
    this.priority = options.priority ?? 50;
    this.charsPerToken = options.charsPerToken ?? 4;
  }

  async check(
    content: string,
    _context?: GuardrailContext,
  ): Promise<GuardrailCheckResult> {
    const estimatedTokens = Math.ceil(content.length / this.charsPerToken);

    if (estimatedTokens <= this.maxTokens) {
      return {
        action: "pass",
        confidence: 1,
        details: { estimatedTokens, maxTokens: this.maxTokens },
      };
    }

    return {
      action: this.action,
      confidence: 1,
      reason: `Token budget exceeded: ~${estimatedTokens} tokens (max: ${this.maxTokens})`,
      details: { estimatedTokens, maxTokens: this.maxTokens },
    };
  }
}
