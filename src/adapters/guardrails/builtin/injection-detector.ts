import type {
  Guardrail,
  GuardrailAction,
  GuardrailCheckResult,
  GuardrailContext,
  GuardrailStage,
} from "../../../ports/guardrails.port.js";

interface InjectionPattern {
  name: string;
  regex: RegExp;
  confidence: number;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: "ignore_previous",
    regex: /ignore\s+(all\s+)?previous\s+instructions/i,
    confidence: 0.95,
  },
  {
    name: "role_override",
    regex: /you\s+are\s+now/i,
    confidence: 0.9,
  },
  {
    name: "system_prefix",
    regex: /^system\s*:/im,
    confidence: 0.85,
  },
  {
    name: "pretend",
    regex: /pretend\s+to\s+be/i,
    confidence: 0.8,
  },
  {
    name: "base64_injection",
    regex: /(?:eval|execute|run)\s*\(\s*(?:atob|decode)\s*\(/i,
    confidence: 0.9,
  },
  {
    name: "markdown_injection",
    regex: /```(?:system|assistant)\s*\n/i,
    confidence: 0.85,
  },
  {
    name: "jailbreak_dan",
    regex: /\bDAN\b.*\bdo\s+anything\s+now\b/i,
    confidence: 0.95,
  },
  {
    name: "override_rules",
    regex: /(?:disregard|forget|override)\s+(?:all\s+)?(?:your\s+)?(?:rules|instructions|guidelines)/i,
    confidence: 0.9,
  },
];

export interface InjectionDetectorOptions {
  action?: GuardrailAction;
  stage?: GuardrailStage | "both";
  priority?: number;
  /** Minimum confidence threshold to trigger (0-1) */
  threshold?: number;
}

export class InjectionDetector implements Guardrail {
  readonly id = "builtin:injection-detector";
  readonly name = "Prompt Injection Detector";
  readonly stage: GuardrailStage | "both";
  readonly priority: number;

  private readonly action: GuardrailAction;
  private readonly threshold: number;

  constructor(options: InjectionDetectorOptions = {}) {
    this.action = options.action ?? "block";
    this.stage = options.stage ?? "input";
    this.priority = options.priority ?? 200;
    this.threshold = options.threshold ?? 0.7;
  }

  async check(
    content: string,
    _context?: GuardrailContext,
  ): Promise<GuardrailCheckResult> {
    const detections: Array<{
      pattern: string;
      confidence: number;
      match: string;
    }> = [];

    for (const pattern of INJECTION_PATTERNS) {
      const match = content.match(pattern.regex);
      if (match && pattern.confidence >= this.threshold) {
        detections.push({
          pattern: pattern.name,
          confidence: pattern.confidence,
          match: match[0],
        });
      }
    }

    if (detections.length === 0) {
      return { action: "pass", confidence: 1 };
    }

    const maxConfidence = Math.max(...detections.map((d) => d.confidence));

    return {
      action: this.action,
      confidence: maxConfidence,
      reason: `Prompt injection detected: ${detections.map((d) => d.pattern).join(", ")}`,
      details: { detections },
    };
  }
}
