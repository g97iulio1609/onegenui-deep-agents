import type {
  OutputSchema,
  ParseResult,
  StreamParser,
} from "../../ports/structured-output.port.js";

/**
 * Streaming JSON parser that incrementally builds an object
 * as chunks arrive from LLM output.
 */
export class JsonStreamParser<T> implements StreamParser<T> {
  private buffer = "";
  private completed = false;
  private readonly schema: OutputSchema<T>;

  constructor(schema: OutputSchema<T>) {
    this.schema = schema;
  }

  feed(chunk: string): void {
    this.buffer += chunk;
    this.completed = this.checkComplete();
  }

  current(): Partial<T> | null {
    const extracted = this.extractPartialJson();
    if (!extracted) return null;

    try {
      return JSON.parse(extracted) as Partial<T>;
    } catch {
      // Try to close the JSON to parse partial content
      const repaired = this.closePartialJson(extracted);
      try {
        return JSON.parse(repaired) as Partial<T>;
      } catch {
        return null;
      }
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  finalize(): ParseResult<T> {
    const extracted = this.extractPartialJson();
    if (!extracted) {
      return {
        success: false,
        raw: this.buffer,
        errors: [{ path: "$", message: "No JSON content found in stream" }],
      };
    }

    try {
      const data = JSON.parse(extracted) as T;
      return { success: true, data, raw: this.buffer };
    } catch {
      const repaired = this.closePartialJson(extracted);
      try {
        const data = JSON.parse(repaired) as T;
        return { success: true, data, raw: this.buffer };
      } catch {
        return {
          success: false,
          raw: this.buffer,
          errors: [{ path: "$", message: "Failed to parse streamed JSON" }],
        };
      }
    }
  }

  private extractPartialJson(): string | null {
    const start = this.buffer.indexOf("{");
    if (start === -1) return null;

    if (this.completed) {
      // Find matching close
      let depth = 0;
      let inString = false;
      let escape = false;

      for (let i = start; i < this.buffer.length; i++) {
        const ch = this.buffer[i];
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
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) return this.buffer.slice(start, i + 1);
        }
      }
    }

    return this.buffer.slice(start);
  }

  private checkComplete(): boolean {
    const start = this.buffer.indexOf("{");
    if (start === -1) return false;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
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
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return true;
      }
    }

    return false;
  }

  private closePartialJson(json: string): string {
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escape = false;

    for (const ch of json) {
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

      if (ch === "{") braces++;
      else if (ch === "}") braces--;
      else if (ch === "[") brackets++;
      else if (ch === "]") brackets--;
    }

    let result = json;

    // Close unterminated string
    if (inString) result += '"';

    // Remove trailing comma
    result = result.replace(/,\s*$/, "");

    for (let i = 0; i < brackets; i++) result += "]";
    for (let i = 0; i < braces; i++) result += "}";

    return result;
  }
}
