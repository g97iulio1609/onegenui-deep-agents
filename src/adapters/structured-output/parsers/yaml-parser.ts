import type {
  OutputSchema,
  ParseResult,
  ValidationError,
} from "../../../ports/structured-output.port.js";

/**
 * Minimal YAML parser supporting flat and one-level-nested key-value pairs.
 * Handles strings, numbers, booleans, null, and simple arrays.
 */
function parseYamlValue(raw: string): unknown {
  const trimmed = raw.trim();

  if (trimmed === "null" || trimmed === "~" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") return num;

  // Strip surrounding quotes
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function extractYamlBlock(raw: string): string {
  const fenceMatch = raw.match(/```(?:ya?ml)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

export function parseYaml<T>(
  raw: string,
  schema: OutputSchema<T>,
): ParseResult<T> {
  const block = extractYamlBlock(raw);
  const lines = block.split("\n");
  const result: Record<string, unknown> = {};
  const errors: ValidationError[] = [];

  let currentKey: string | null = null;
  let currentArray: unknown[] | null = null;

  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    // Array item under a key
    const arrayItemMatch = line.match(/^\s+-\s+(.*)/);
    if (arrayItemMatch && currentKey) {
      if (!currentArray) {
        currentArray = [];
        result[currentKey] = currentArray;
      }
      currentArray.push(parseYamlValue(arrayItemMatch[1]));
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w\s-]*):\s*(.*)/);
    if (kvMatch) {
      // Flush previous array
      currentArray = null;

      const key = kvMatch[1].trim();
      const value = kvMatch[2];
      currentKey = key;

      if (value.trim() === "") {
        // Could be start of array or nested block — handled in next iterations
        result[key] = null;
      } else {
        result[key] = parseYamlValue(value);
      }
      continue;
    }
  }

  if (Object.keys(result).length === 0) {
    errors.push({ path: "$", message: "Failed to parse YAML content" });
    return { success: false, raw, errors };
  }

  // Validate required fields from definition
  for (const key of Object.keys(schema.definition)) {
    if (!(key in result)) {
      const spec = schema.definition[key];
      const isRequired =
        typeof spec === "object" && spec !== null
          ? (spec as Record<string, unknown>).required !== false
          : true;

      if (isRequired) {
        errors.push({
          path: key,
          message: `Missing required field "${key}"`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, raw, errors };
  }

  return { success: true, data: result as T, raw };
}
