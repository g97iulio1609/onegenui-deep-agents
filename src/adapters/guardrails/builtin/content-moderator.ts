import type {
  Guardrail,
  GuardrailAction,
  GuardrailCheckResult,
  GuardrailContext,
  GuardrailStage,
} from "../../../ports/guardrails.port.js";

interface ModerationCategory {
  name: string;
  patterns: RegExp[];
  severity: "low" | "medium" | "high";
}

const DEFAULT_CATEGORIES: ModerationCategory[] = [
  {
    name: "profanity",
    patterns: [
      /\b(?:fuck|shit|damn|ass|bastard|bitch)\b/gi,
    ],
    severity: "medium",
  },
  {
    name: "hate_speech",
    patterns: [
      /\b(?:kill\s+all|death\s+to|exterminate)\b/gi,
    ],
    severity: "high",
  },
  {
    name: "threat",
    patterns: [
      /\b(?:i\s+will\s+(?:kill|hurt|destroy|attack)\s+you)\b/gi,
    ],
    severity: "high",
  },
];

const SEVERITY_CONFIDENCE: Record<string, number> = {
  low: 0.6,
  medium: 0.8,
  high: 0.95,
};

export interface ContentModeratorOptions {
  action?: GuardrailAction;
  stage?: GuardrailStage | "both";
  priority?: number;
  categories?: ModerationCategory[];
}

export class ContentModerator implements Guardrail {
  readonly id = "builtin:content-moderator";
  readonly name = "Content Moderator";
  readonly stage: GuardrailStage | "both";
  readonly priority: number;

  private readonly action: GuardrailAction;
  private readonly categories: ModerationCategory[];

  constructor(options: ContentModeratorOptions = {}) {
    this.action = options.action ?? "block";
    this.stage = options.stage ?? "both";
    this.priority = options.priority ?? 150;
    this.categories = options.categories ?? DEFAULT_CATEGORIES;
  }

  async check(
    content: string,
    _context?: GuardrailContext,
  ): Promise<GuardrailCheckResult> {
    const detections: Array<{
      category: string;
      severity: string;
      match: string;
    }> = [];

    for (const category of this.categories) {
      for (const pattern of category.patterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            detections.push({
              category: category.name,
              severity: category.severity,
              match,
            });
          }
        }
      }
    }

    if (detections.length === 0) {
      return { action: "pass", confidence: 1 };
    }

    const maxSeverity = detections.reduce(
      (max, d) =>
        (SEVERITY_CONFIDENCE[d.severity] ?? 0) >
        (SEVERITY_CONFIDENCE[max.severity] ?? 0)
          ? d
          : max,
      detections[0]!,
    );

    return {
      action: this.action,
      confidence: SEVERITY_CONFIDENCE[maxSeverity.severity] ?? 0.5,
      reason: `Content moderation violation: ${[...new Set(detections.map((d) => d.category))].join(", ")}`,
      details: { detections },
    };
  }
}
