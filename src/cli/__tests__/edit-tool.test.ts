// =============================================================================
// Tests — editFile tool
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCliTools } from "../tools.js";

// Disable ANSI colors
vi.stubGlobal("process", { ...process, stdout: { ...process.stdout, isTTY: false } });

describe("editFile tool", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `edit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try { rmdirSync(tempDir, { recursive: true } as any); } catch {}
  });

  function makeTempFile(name: string, content: string): string {
    const p = join(tempDir, name);
    writeFileSync(p, content, "utf-8");
    return p;
  }

  it("performs a successful single-match edit", async () => {
    const filePath = makeTempFile("a.txt", "hello world\nfoo bar\nbaz");
    const tools = createCliTools({ yolo: true, confirm: async () => true });
    const result = await tools.editFile.execute(
      { path: filePath, old_str: "foo bar", new_str: "FOO BAR" },
      { toolCallId: "t1", messages: [], abortSignal: undefined as any },
    );
    expect(result).toHaveProperty("path");
    expect(readFileSync(filePath, "utf-8")).toBe("hello world\nFOO BAR\nbaz");
  });

  it("errors when no match is found", async () => {
    const filePath = makeTempFile("b.txt", "hello world");
    const tools = createCliTools({ yolo: true, confirm: async () => true });
    const result = await tools.editFile.execute(
      { path: filePath, old_str: "not found", new_str: "replacement" },
      { toolCallId: "t2", messages: [], abortSignal: undefined as any },
    );
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("not found");
  });

  it("errors when multiple matches are found", async () => {
    const filePath = makeTempFile("c.txt", "aaa\naaa\nbbb");
    const tools = createCliTools({ yolo: true, confirm: async () => true });
    const result = await tools.editFile.execute(
      { path: filePath, old_str: "aaa", new_str: "ccc" },
      { toolCallId: "t3", messages: [], abortSignal: undefined as any },
    );
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("2");
  });

  it("respects confirm gate — cancel returns error", async () => {
    const filePath = makeTempFile("d.txt", "hello world");
    const tools = createCliTools({ yolo: false, confirm: async () => false });
    const result = await tools.editFile.execute(
      { path: filePath, old_str: "hello", new_str: "goodbye" },
      { toolCallId: "t4", messages: [], abortSignal: undefined as any },
    );
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("cancelled");
    // File unchanged
    expect(readFileSync(filePath, "utf-8")).toBe("hello world");
  });

  it("yolo mode bypasses confirmation", async () => {
    const filePath = makeTempFile("e.txt", "hello world");
    const confirmFn = vi.fn();
    const tools = createCliTools({ yolo: true, confirm: confirmFn });
    await tools.editFile.execute(
      { path: filePath, old_str: "hello", new_str: "goodbye" },
      { toolCallId: "t5", messages: [], abortSignal: undefined as any },
    );
    expect(confirmFn).not.toHaveBeenCalled();
    expect(readFileSync(filePath, "utf-8")).toBe("goodbye world");
  });
});
