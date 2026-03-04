/**
 * StructuredStream — Incremental JSON streaming with partial parsing and schema validation.
 *
 * Used server-side to progressively emit typed partial objects from an LLM stream.
 *
 * @example
 * ```ts
 * import { StructuredStream } from "gauss-ts";
 *
 * const stream = new StructuredStream<{ name: string; age: number }>({
 *   type: "object",
 *   properties: { name: { type: "string" }, age: { type: "number" } },
 *   required: ["name", "age"],
 * });
 *
 * const partial = stream.writePartial('{"name":"Alice"');
 * // partial => { name: "Alice" }
 * ```
 *
 * @since 2.0.0
 */

// ─── Types ─────────────────────────────────────────────────────────

/** Minimal JSON Schema subset for validation. */
export interface StructuredStreamSchema {
  type: string;
  properties?: Record<string, StructuredStreamSchema>;
  items?: StructuredStreamSchema;
  required?: string[];
  enum?: unknown[];
  [key: string]: unknown;
}

// ─── Cached Regex Patterns ─────────────────────────────────────────

const TRAILING_COMMA_RE = /,\s*$/;
const TRAILING_COLON_RE = /:\s*$/;

// ─── Implementation ────────────────────────────────────────────────

/**
 * Streaming structured output with incremental parsing and schema validation.
 *
 * @typeParam T - The expected final shape of the parsed object.
 *
 * @since 2.0.0
 */
export class StructuredStream<T = unknown> {
  private readonly schema: StructuredStreamSchema;
  private chunks: string[] = [];
  private _buffer: string | null = "";
  private bufferLength: number = 0;
  private lastParsedLength: number = 0;
  private lastParsedResult: Partial<T> | null = null;

  constructor(schema: StructuredStreamSchema) {
    this.schema = schema;
  }

  /** Compact chunks into a single string, caching the result. */
  private compactBuffer(): string {
    if (this._buffer !== null) return this._buffer;
    this._buffer = this.chunks.join("");
    this.chunks = [this._buffer];
    return this._buffer;
  }

  /**
   * Append a delta string and attempt to parse the accumulated buffer.
   *
   * @param delta - The new JSON text chunk to append.
   * @returns A partial object if parseable, or `null`.
   */
  writePartial(delta: string): Partial<T> | null {
    if (!delta) return this.lastParsedResult;
    this.chunks.push(delta);
    this.bufferLength += delta.length;
    this._buffer = null;
    if (this.bufferLength === this.lastParsedLength) return this.lastParsedResult;
    const buf = this.compactBuffer();
    try {
      const result = JSON.parse(buf) as Partial<T>;
      this.lastParsedLength = this.bufferLength;
      this.lastParsedResult = result;
      return result;
    } catch {
      const result = this.parsePartial(buf);
      if (result !== null) {
        this.lastParsedLength = this.bufferLength;
        this.lastParsedResult = result;
      }
      return result ?? this.lastParsedResult;
    }
  }

  /**
   * Validate a (possibly partial) object against the schema.
   *
   * @param obj - The object to validate.
   * @returns `true` if the object conforms to the schema structure.
   */
  validate(obj: unknown): boolean {
    return validateAgainstSchema(obj, this.schema);
  }

  /**
   * Reset the internal buffer.
   */
  reset(): void {
    this.chunks = [];
    this._buffer = "";
    this.bufferLength = 0;
    this.lastParsedLength = 0;
    this.lastParsedResult = null;
  }

  /**
   * Get the current buffer content.
   */
  getBuffer(): string {
    return this.compactBuffer();
  }

  /**
   * Attempt to parse an incomplete JSON string by closing unclosed structures.
   * @internal
   */
  private parsePartial(json: string): Partial<T> | null {
    return parsePartialJson(json) as Partial<T> | null;
  }
}

// ─── Partial JSON Parser ──────────────────────────────────────────

/**
 * Parse a potentially incomplete JSON string by closing unclosed braces and brackets.
 *
 * @param json - The incomplete JSON string.
 * @returns The parsed object, or `null` if unparseable.
 *
 * @internal
 */
export function parsePartialJson(json: string): unknown | null {
  const trimmed = json.trim();
  if (!trimmed) return null;

  // Try parsing as-is first
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to repair
  }

  // Track unclosed structures
  const closers: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

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

    if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }

  if (closers.length === 0) return null;

  // If we're inside a string, close it
  let repaired = trimmed;
  if (inString) {
    repaired += '"';
  }

  // Remove trailing comma or colon with incomplete value
  repaired = repaired.replace(TRAILING_COMMA_RE, "");
  repaired = repaired.replace(TRAILING_COLON_RE, ': null');

  // Close all unclosed structures
  while (closers.length > 0) {
    repaired += closers.pop();
  }

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

// ─── Schema Validation ────────────────────────────────────────────

/**
 * Validate an object against a minimal JSON schema definition.
 *
 * Performs structural type-checking only (no $ref, allOf, etc.).
 *
 * @internal
 */
function validateAgainstSchema(obj: unknown, schema: StructuredStreamSchema): boolean {
  if (obj === null || obj === undefined) return false;

  switch (schema.type) {
    case "object": {
      if (typeof obj !== "object" || Array.isArray(obj)) return false;
      const record = obj as Record<string, unknown>;

      // Check required fields
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in record)) return false;
        }
      }

      // Validate known properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in record && !validateAgainstSchema(record[key], propSchema)) {
            return false;
          }
        }
      }
      return true;
    }
    case "array": {
      if (!Array.isArray(obj)) return false;
      if (schema.items) {
        return obj.every((item) => validateAgainstSchema(item, schema.items!));
      }
      return true;
    }
    case "string":
      if (typeof obj !== "string") return false;
      if (schema.enum && !schema.enum.includes(obj)) return false;
      return true;
    case "number":
    case "integer":
      return typeof obj === "number";
    case "boolean":
      return typeof obj === "boolean";
    default:
      return true;
  }
}
