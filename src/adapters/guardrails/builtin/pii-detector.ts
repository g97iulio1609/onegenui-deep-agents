import type {
  Guardrail,
  GuardrailAction,
  GuardrailCheckResult,
  GuardrailContext,
  GuardrailStage,
} from "../../../ports/guardrails.port.js";

interface PiiPattern {
  name: string;
  regex: RegExp;
  tag: string;
}

// Order matters: more specific patterns (CC, SSN) must precede phone to avoid
// partial overlaps where the phone regex could consume part of a CC number.
const PII_PATTERNS: PiiPattern[] = [
  {
    name: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    tag: "REDACTED_EMAIL",
  },
  {
    name: "credit_card",
    regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    tag: "REDACTED_CC",
  },
  {
    name: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    tag: "REDACTED_SSN",
  },
  {
    name: "phone",
    regex: /\+?\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g,
    tag: "REDACTED_PHONE",
  },
];

export interface PiiDetectorOptions {
  action?: GuardrailAction;
  stage?: GuardrailStage | "both";
  priority?: number;
}

export class PiiDetector implements Guardrail {
  readonly id = "builtin:pii-detector";
  readonly name = "PII Detector";
  readonly stage: GuardrailStage | "both";
  readonly priority: number;

  private readonly action: GuardrailAction;

  constructor(options: PiiDetectorOptions = {}) {
    this.action = options.action ?? "redact";
    this.stage = options.stage ?? "both";
    this.priority = options.priority ?? 100;
  }

  async check(
    content: string,
    _context?: GuardrailContext,
  ): Promise<GuardrailCheckResult> {
    const detections: Array<{ type: string; match: string }> = [];
    let redacted = content;

    for (const pattern of PII_PATTERNS) {
      // Match against the current redacted string so earlier replacements
      // prevent less-specific patterns from overlapping.
      const matches = redacted.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          detections.push({ type: pattern.name, match });
          redacted = redacted.replaceAll(match, `[${pattern.tag}]`);
        }
      }
    }

    if (detections.length === 0) {
      return { action: "pass", confidence: 1 };
    }

    return {
      action: this.action,
      confidence: 0.95,
      reason: `Detected PII: ${detections.map((d) => d.type).join(", ")}`,
      details: { detections },
      transformedContent: this.action === "redact" ? redacted : undefined,
    };
  }
}
