import { describe, expect, it } from "vitest";
import { StructuredOutputAdapter } from "../structured-output.adapter.js";
import type {
  OutputConstraint,
  OutputSchema,
} from "../../../ports/structured-output.port.js";

const adapter = new StructuredOutputAdapter();

const jsonSchema: OutputSchema<{ name: string; age: number }> = {
  type: "json",
  definition: { name: "string", age: "number" },
  description: "A person",
};

describe("StructuredOutputAdapter", () => {
  // ── JSON Parsing ─────────────────────────────────────────────────────

  describe("parse() — JSON", () => {
    it("1. should parse valid JSON against schema", () => {
      const result = adapter.parse('{"name":"Alice","age":30}', jsonSchema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    });

    it("2. should reject invalid JSON", () => {
      const result = adapter.parse("{not json at all", jsonSchema);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("3. should reject wrong types", () => {
      const result = adapter.parse('{"name":123,"age":"thirty"}', jsonSchema);
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.path === "name")).toBe(true);
      expect(result.errors!.some((e) => e.path === "age")).toBe(true);
    });

    it("4. should reject missing required fields", () => {
      const result = adapter.parse('{"name":"Alice"}', jsonSchema);
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.message.includes("age"))).toBe(true);
    });

    it("should extract JSON from markdown code fences", () => {
      const raw = 'Here is the output:\n```json\n{"name":"Bob","age":25}\n```';
      const result = adapter.parse(raw, jsonSchema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Bob", age: 25 });
    });
  });

  // ── Repair ───────────────────────────────────────────────────────────

  describe("repair()", () => {
    it("5. should fix trailing commas", () => {
      const result = adapter.repair('{"name":"Alice","age":30,}', jsonSchema, []);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
      expect(result.repairs.some((r) => r.description.includes("trailing"))).toBe(true);
    });

    it("6. should fix missing closing brace", () => {
      const result = adapter.repair('{"name":"Alice","age":30', jsonSchema, []);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
      expect(result.repairs.some((r) => r.description.includes("closing"))).toBe(true);
    });

    it("7. should fix unquoted keys", () => {
      const result = adapter.repair('{name:"Alice",age:30}', jsonSchema, []);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
      expect(result.repairs.some((r) => r.description.includes("unquoted"))).toBe(true);
    });

    it("8. should fix single quotes", () => {
      const result = adapter.repair("{'name':'Alice','age':30}", jsonSchema, []);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
      expect(result.repairs.some((r) => r.description.includes("single quotes"))).toBe(true);
    });

    it("9. should fix truncated string", () => {
      const result = adapter.repair('{"name":"Alice","age":30,"bio":"hello', jsonSchema, []);
      expect(result.success).toBe(true);
      expect(result.repairs.some((r) => r.description.includes("truncated") || r.description.includes("closing"))).toBe(true);
    });

    it("should replace NaN/Infinity with null", () => {
      const schema: OutputSchema<{ value: null }> = {
        type: "json",
        definition: { value: "null" },
      };
      const result = adapter.repair('{"value": NaN}', schema, []);
      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)?.value).toBeNull();
    });
  });

  // ── Format Instruction ───────────────────────────────────────────────

  describe("formatInstruction()", () => {
    it("10. should generate concise format", () => {
      const instruction = adapter.formatInstruction(jsonSchema, {
        style: "concise",
      });
      expect(instruction).toContain("JSON");
      expect(instruction).toContain("name");
      expect(instruction).toContain("age");
    });

    it("11. should generate detailed format with examples", () => {
      const schema: OutputSchema<{ name: string }> = {
        type: "json",
        definition: { name: "string" },
        description: "A person name",
        examples: [{ name: "Alice" }],
      };
      const instruction = adapter.formatInstruction(schema, {
        style: "with-examples",
      });
      expect(instruction).toContain("Alice");
      expect(instruction).toContain("Examples");
    });

    it("should wrap in code block when requested", () => {
      const instruction = adapter.formatInstruction(jsonSchema, {
        style: "concise",
        wrapInCodeBlock: true,
      });
      expect(instruction).toMatch(/^```/);
      expect(instruction).toMatch(/```$/);
    });
  });

  // ── Validate ─────────────────────────────────────────────────────────

  describe("validate()", () => {
    it("12. should pass when all constraints are met", () => {
      const constraints: OutputConstraint<{ name: string; age: number }>[] = [
        {
          field: "age",
          check: (v) => typeof v === "number" && v > 0,
          message: "Age must be positive",
        },
      ];
      const result = adapter.validate({ name: "Alice", age: 30 }, constraints);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("13. should fail with errors when constraints are violated", () => {
      const constraints: OutputConstraint<{ name: string; age: number }>[] = [
        {
          field: "age",
          check: (v) => typeof v === "number" && v > 0,
          message: "Age must be positive",
        },
      ];
      const result = adapter.validate({ name: "Alice", age: -5 }, constraints);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Age must be positive");
    });

    it("20. should collect multiple validation errors", () => {
      const constraints: OutputConstraint<{ name: string; age: number }>[] = [
        {
          field: "name",
          check: (v) => typeof v === "string" && (v as string).length > 0,
          message: "Name must not be empty",
        },
        {
          field: "age",
          check: (v) => typeof v === "number" && v > 0,
          message: "Age must be positive",
        },
      ];
      const result = adapter.validate({ name: "", age: -1 }, constraints);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  // ── Stream Parser ────────────────────────────────────────────────────

  describe("parseStream()", () => {
    it("14. should feed chunks and build partial result", () => {
      const stream = adapter.parseStream(jsonSchema);
      stream.feed('{"name"');
      stream.feed(':"Alice"');
      stream.feed(',"age":30}');

      const partial = stream.current();
      expect(partial).toBeDefined();
      expect((partial as Record<string, unknown>)?.name).toBe("Alice");
    });

    it("15. should report isComplete when done", () => {
      const stream = adapter.parseStream(jsonSchema);
      stream.feed('{"name":"Alice"');
      expect(stream.isComplete()).toBe(false);
      stream.feed(',"age":30}');
      expect(stream.isComplete()).toBe(true);
    });

    it("16. should finalize to full result", () => {
      const stream = adapter.parseStream(jsonSchema);
      stream.feed('{"name":"Alice","age":30}');
      const result = stream.finalize();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    });

    it("should return null for current() with no JSON content", () => {
      const stream = adapter.parseStream(jsonSchema);
      stream.feed("no json here");
      expect(stream.current()).toBeNull();
    });
  });

  // ── YAML Parser ──────────────────────────────────────────────────────

  describe("parse() — YAML", () => {
    it("17. should parse basic YAML key-value pairs", () => {
      const schema: OutputSchema<{ name: string; age: number }> = {
        type: "yaml",
        definition: { name: "string", age: "number" },
      };
      const raw = "name: Alice\nage: 30";
      const result = adapter.parse(raw, schema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    });

    it("should handle YAML booleans and null", () => {
      const schema: OutputSchema<{ active: boolean; value: null }> = {
        type: "yaml",
        definition: { active: "boolean" },
      };
      const raw = "active: true\nvalue: null";
      const result = adapter.parse(raw, schema);
      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)?.active).toBe(true);
    });
  });

  // ── CSV Parser ───────────────────────────────────────────────────────

  describe("parse() — CSV", () => {
    it("18. should parse headers and rows", () => {
      const schema: OutputSchema<Array<Record<string, string>>> = {
        type: "csv",
        definition: {},
      };
      const raw = "name,age\nAlice,30\nBob,25";
      const result = adapter.parse(raw, schema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle quoted CSV fields", () => {
      const schema: OutputSchema<Array<Record<string, string>>> = {
        type: "csv",
        definition: {},
      };
      const raw = 'name,bio\nAlice,"Loves, coding"\nBob,"Says ""hello"""';
      const result = adapter.parse(raw, schema);
      expect(result.success).toBe(true);
      const data = result.data as Array<Record<string, string>>;
      expect(data[0].bio).toBe("Loves, coding");
      expect(data[1].bio).toBe('Says "hello"');
    });
  });

  // ── Markdown Table Parser ────────────────────────────────────────────

  describe("parse() — Markdown Table", () => {
    it("19. should extract rows from markdown table", () => {
      const schema: OutputSchema<Array<Record<string, string>>> = {
        type: "markdown-table",
        definition: {},
      };
      const raw = [
        "| name  | age |",
        "|-------|-----|",
        "| Alice | 30  |",
        "| Bob   | 25  |",
      ].join("\n");
      const result = adapter.parse(raw, schema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should reject input without table", () => {
      const schema: OutputSchema<unknown[]> = {
        type: "markdown-table",
        definition: {},
      };
      const result = adapter.parse("No table here", schema);
      expect(result.success).toBe(false);
    });
  });

  // ── Unsupported type ─────────────────────────────────────────────────

  describe("parse() — unsupported", () => {
    it("should return error for unsupported schema type", () => {
      const schema = { type: "xml" as const, definition: {} };
      const result = adapter.parse("<xml/>", schema as OutputSchema<unknown>);
      expect(result.success).toBe(false);
      expect(result.errors![0].message).toContain("Unsupported");
    });
  });
});
