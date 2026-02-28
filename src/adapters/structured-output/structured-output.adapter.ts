import type {
  FormatOptions,
  OutputConstraint,
  OutputSchema,
  ParseResult,
  RepairResult,
  StreamParser,
  StructuredOutputPort,
  ValidationError,
  ValidationResult,
} from "../../ports/structured-output.port.js";
import { parseJson } from "./parsers/json-parser.js";
import { parseYaml } from "./parsers/yaml-parser.js";
import { parseCsv } from "./parsers/csv-parser.js";
import { parseMarkdownTable } from "./parsers/markdown-parser.js";
import { repairJson } from "./repair-engine.js";
import { JsonStreamParser } from "./stream-parser.js";

export class StructuredOutputAdapter implements StructuredOutputPort {
  parse<T>(raw: string, schema: OutputSchema<T>): ParseResult<T> {
    switch (schema.type) {
      case "json":
        return parseJson(raw, schema);
      case "yaml":
        return parseYaml(raw, schema);
      case "csv":
        return parseCsv(raw, schema);
      case "markdown-table":
        return parseMarkdownTable(raw, schema);
      default:
        return {
          success: false,
          raw,
          errors: [
            {
              path: "$",
              message: `Unsupported schema type: ${schema.type}`,
            },
          ],
        };
    }
  }

  repair<T>(
    raw: string,
    schema: OutputSchema<T>,
    errors: ValidationError[],
  ): RepairResult<T> {
    if (schema.type === "json") {
      return repairJson(raw, schema, errors);
    }

    return { success: false, repaired: raw, repairs: [] };
  }

  formatInstruction<T>(
    schema: OutputSchema<T>,
    options?: FormatOptions,
  ): string {
    const style = options?.style ?? "concise";
    const wrap = options?.wrapInCodeBlock ?? false;

    const schemaStr = JSON.stringify(schema.definition, null, 2);
    let instruction: string;

    switch (style) {
      case "concise":
        instruction = `Respond with valid ${schema.type.toUpperCase()} matching this schema:\n${schemaStr}`;
        break;

      case "detailed":
        instruction = [
          `You must respond with valid ${schema.type.toUpperCase()} only.`,
          `Do not include any text before or after the ${schema.type.toUpperCase()} output.`,
          "",
          "Required schema:",
          schemaStr,
          "",
          schema.description ? `Description: ${schema.description}` : "",
          "",
          "Rules:",
          "- All required fields must be present",
          "- Use the exact field names shown",
          "- Values must match the specified types",
        ]
          .filter(Boolean)
          .join("\n");
        break;

      case "with-examples": {
        const parts = [
          `Respond with valid ${schema.type.toUpperCase()} matching this schema:`,
          schemaStr,
        ];

        if (schema.examples && schema.examples.length > 0) {
          parts.push("", "Examples:");
          for (const example of schema.examples) {
            parts.push(JSON.stringify(example, null, 2));
          }
        }

        instruction = parts.join("\n");
        break;
      }

      default:
        instruction = `Respond with valid ${schema.type.toUpperCase()} matching: ${schemaStr}`;
    }

    if (wrap) {
      return `\`\`\`\n${instruction}\n\`\`\``;
    }

    return instruction;
  }

  validate<T>(
    value: T,
    constraints: OutputConstraint<T>[],
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const constraint of constraints) {
      const fieldValue = this.getFieldValue(value, constraint.field);
      if (!constraint.check(fieldValue)) {
        errors.push({
          path: constraint.field,
          message: constraint.message,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  parseStream<T>(schema: OutputSchema<T>): StreamParser<T> {
    return new JsonStreamParser<T>(schema);
  }

  private getFieldValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
