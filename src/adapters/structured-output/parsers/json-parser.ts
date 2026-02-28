import type {
  OutputSchema,
  ParseResult,
  ValidationError,
} from "../../../ports/structured-output.port.js";

/**
 * Extract a JSON block from raw LLM output.
 * Handles markdown code fences and bare JSON.
 */
function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = raw.indexOf("{");
  const bracketStart = raw.indexOf("[");

  if (braceStart === -1 && bracketStart === -1) return raw.trim();

  const start =
    braceStart === -1
      ? bracketStart
      : bracketStart === -1
        ? braceStart
        : Math.min(braceStart, bracketStart);

  const isObject = raw[start] === "{";
  const close = isObject ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === raw[start]) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return raw.slice(start);
}

function validateAgainstDefinition(
  value: unknown,
  definition: Record<string, unknown>,
  path: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push({
      path: path || "$",
      message: "Expected an object",
      expected: "object",
      received: Array.isArray(value) ? "array" : typeof value,
    });
    return errors;
  }

  const obj = value as Record<string, unknown>;

  for (const [key, spec] of Object.entries(definition)) {
    const fieldPath = path ? `${path}.${key}` : key;
    const expectedType = typeof spec === "string" ? spec : (spec as Record<string, unknown>)?.type;

    if (!(key in obj)) {
      const isRequired =
        typeof spec === "object" && spec !== null
          ? (spec as Record<string, unknown>).required !== false
          : true;

      if (isRequired) {
        errors.push({
          path: fieldPath,
          message: `Missing required field "${key}"`,
          expected: String(expectedType ?? "unknown"),
        });
      }
      continue;
    }

    if (typeof expectedType === "string") {
      const actual = obj[key];
      const actualType = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;

      if (expectedType !== actualType) {
        errors.push({
          path: fieldPath,
          message: `Expected type "${expectedType}" but got "${actualType}"`,
          expected: expectedType,
          received: actualType,
        });
      }
    }
  }

  return errors;
}

export function parseJson<T>(
  raw: string,
  schema: OutputSchema<T>,
): ParseResult<T> {
  const extracted = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch {
    return {
      success: false,
      raw,
      errors: [
        {
          path: "$",
          message: "Invalid JSON",
          received: extracted.slice(0, 80),
        },
      ],
    };
  }

  const errors = validateAgainstDefinition(parsed, schema.definition, "");
  if (errors.length > 0) {
    return { success: false, raw, errors };
  }

  return { success: true, data: parsed as T, raw };
}
