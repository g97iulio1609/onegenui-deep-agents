import type {
  Guardrail,
  GuardrailContext,
  GuardrailResult,
  GuardrailsPort,
  GuardrailStage,
} from "../../ports/guardrails.port.js";

export class GuardrailsAdapter implements GuardrailsPort {
  private guardrails: Map<string, Guardrail> = new Map();

  addGuardrail(guardrail: Guardrail): void {
    this.guardrails.set(guardrail.id, guardrail);
  }

  removeGuardrail(id: string): void {
    this.guardrails.delete(id);
  }

  listGuardrails(stage?: GuardrailStage): Guardrail[] {
    const all = [...this.guardrails.values()];
    if (!stage) return all;
    return all.filter((g) => g.stage === stage || g.stage === "both");
  }

  async check(
    content: string,
    stage: GuardrailStage,
    context?: GuardrailContext,
  ): Promise<GuardrailResult> {
    const applicable = this.listGuardrails(stage).sort(
      (a, b) => b.priority - a.priority,
    );

    const checks: GuardrailResult["checks"] = [];
    let currentContent = content;

    for (const guardrail of applicable) {
      const result = await guardrail.check(currentContent, context);

      checks.push({
        guardrailId: guardrail.id,
        guardrailName: guardrail.name,
        result,
      });

      if (result.action === "block") {
        return {
          allowed: false,
          finalContent: currentContent,
          checks,
          blockedBy: guardrail.id,
        };
      }

      if (
        (result.action === "redact" || result.action === "transform") &&
        result.transformedContent !== undefined
      ) {
        currentContent = result.transformedContent;
      }
    }

    return {
      allowed: true,
      finalContent: currentContent,
      checks,
    };
  }
}
