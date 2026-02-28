import type {
  Guardrail,
  GuardrailAction,
  GuardrailCheckResult,
  GuardrailContext,
  GuardrailStage,
} from "../../../ports/guardrails.port.js";

/** Lightweight JSON schema subset for zero-dependency validation */
export interface SimpleSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, SimpleSchema>;
  items?: SimpleSchema;
  required?: string[];
}

export interface SchemaValidatorOptions {
  schema: SimpleSchema;
  action?: GuardrailAction;
  stage?: GuardrailStage | "both";
  priority?: number;
}

export class SchemaValidator implements Guardrail {
  readonly id = "builtin:schema-validator";
  readonly name = "Schema Validator";
  readonly stage: GuardrailStage | "both";
  readonly priority: number;

  private readonly schema: SimpleSchema;
  private readonly action: GuardrailAction;

  constructor(options: SchemaValidatorOptions) {
    this.schema = options.schema;
    this.action = options.action ?? "block";
    this.stage = options.stage ?? "output";
    this.priority = options.priority ?? 300;
  }

  async check(
    content: string,
    _context?: GuardrailContext,
  ): Promise<GuardrailCheckResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        action: this.action,
        confidence: 1,
        reason: "Output is not valid JSON",
        details: { error: "parse_error" },
      };
    }

    const errors = this.validate(parsed, this.schema, "root");
    if (errors.length === 0) {
      return { action: "pass", confidence: 1 };
    }

    return {
      action: this.action,
      confidence: 1,
      reason: `Schema validation failed: ${errors.join("; ")}`,
      details: { errors },
    };
  }

  private validate(
    value: unknown,
    schema: SimpleSchema,
    path: string,
  ): string[] {
    const errors: string[] = [];

    switch (schema.type) {
      case "object": {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          errors.push(`${path}: expected object`);
          break;
        }
        const obj = value as Record<string, unknown>;
        if (schema.required) {
          for (const key of schema.required) {
            if (!(key in obj)) {
              errors.push(`${path}.${key}: required field missing`);
            }
          }
        }
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (key in obj) {
              errors.push(
                ...this.validate(obj[key], propSchema, `${path}.${key}`),
              );
            }
          }
        }
        break;
      }
      case "array": {
        if (!Array.isArray(value)) {
          errors.push(`${path}: expected array`);
          break;
        }
        if (schema.items) {
          for (let i = 0; i < value.length; i++) {
            errors.push(
              ...this.validate(value[i], schema.items, `${path}[${i}]`),
            );
          }
        }
        break;
      }
      case "string":
        if (typeof value !== "string") errors.push(`${path}: expected string`);
        break;
      case "number":
        if (typeof value !== "number") errors.push(`${path}: expected number`);
        break;
      case "boolean":
        if (typeof value !== "boolean")
          errors.push(`${path}: expected boolean`);
        break;
    }

    return errors;
  }
}
