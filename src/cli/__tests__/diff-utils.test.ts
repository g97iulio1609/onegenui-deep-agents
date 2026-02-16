// =============================================================================
// Tests — Unified Diff Generator
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Disable ANSI colors so assertions match plain text
vi.stubGlobal("process", { ...process, stdout: { ...process.stdout, isTTY: false } });

import { generateUnifiedDiff } from "../diff-utils.js";

describe("generateUnifiedDiff", () => {
  it("returns empty string for identical content", () => {
    const content = "line1\nline2\nline3";
    expect(generateUnifiedDiff(content, content, "test.ts")).toBe("");
  });

  it("handles single line change", () => {
    const oldContent = "line1\nline2\nline3";
    const newContent = "line1\nchanged\nline3";
    const diff = generateUnifiedDiff(oldContent, newContent, "test.ts");
    expect(diff).toContain("--- a/test.ts");
    expect(diff).toContain("+++ b/test.ts");
    expect(diff).toContain("-line2");
    expect(diff).toContain("+changed");
    expect(diff).toContain(" line1");
    expect(diff).toContain(" line3");
  });

  it("handles multi-line addition", () => {
    const oldContent = "line1\nline2";
    const newContent = "line1\nnew1\nnew2\nline2";
    const diff = generateUnifiedDiff(oldContent, newContent, "test.ts");
    expect(diff).toContain("+new1");
    expect(diff).toContain("+new2");
    expect(diff).not.toContain("-line1");
    expect(diff).not.toContain("-line2");
  });

  it("handles multi-line deletion", () => {
    const oldContent = "line1\ndel1\ndel2\nline2";
    const newContent = "line1\nline2";
    const diff = generateUnifiedDiff(oldContent, newContent, "test.ts");
    expect(diff).toContain("-del1");
    expect(diff).toContain("-del2");
    // No inserted lines (only headers and deletions)
    expect(diff).not.toMatch(/^\+[^+]/m);
  });

  it("handles empty file to content", () => {
    const diff = generateUnifiedDiff("", "hello\nworld", "test.ts");
    expect(diff).toContain("+hello");
    expect(diff).toContain("+world");
  });

  it("handles content to empty file", () => {
    const diff = generateUnifiedDiff("hello\nworld", "", "test.ts");
    expect(diff).toContain("-hello");
    expect(diff).toContain("-world");
  });

  it("shows context lines around changes in large files", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
    const oldContent = lines.join("\n");
    const newLines = [...lines];
    newLines[10] = "CHANGED";
    const newContent = newLines.join("\n");
    const diff = generateUnifiedDiff(oldContent, newContent, "big.ts");

    // Should have context lines around the change (lines 8-14 approx)
    expect(diff).toContain(" line10");
    expect(diff).toContain("-line11");
    expect(diff).toContain("+CHANGED");
    expect(diff).toContain(" line12");
    // Lines far from change should not appear
    expect(diff).not.toContain(" line1\n");
    expect(diff).not.toContain(" line20");
  });

  it("includes @@ hunk markers", () => {
    const diff = generateUnifiedDiff("a\nb\nc", "a\nB\nc", "f.ts");
    expect(diff).toMatch(/@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/);
  });
});
