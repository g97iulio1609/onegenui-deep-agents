// =============================================================================
// CLI Diff Utils — Unified diff generator (zero dependencies)
// =============================================================================

import { color } from "./format.js";

/**
 * Generate a colored unified diff between two strings.
 * Uses a simple LCS-based line diff with 3 lines of context.
 */
export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const MAX_DIFF_LINES = 1000;
  if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
    const removed = oldLines.length;
    const added = newLines.length;
    return color("dim", `(file too large for inline diff — ${removed} old lines, ${added} new lines)`);
  }

  // Compute edit script using simple LCS
  const ops = computeEditOps(oldLines, newLines);

  if (ops.every((op) => op.type === "equal")) return "";

  const hunks = buildHunks(ops, 3);
  const lines: string[] = [
    color("dim", `--- a/${filePath}`),
    color("dim", `+++ b/${filePath}`),
  ];

  for (const hunk of hunks) {
    lines.push(
      color("cyan", `@@ -${hunk.oldStart + 1},${hunk.oldCount} +${hunk.newStart + 1},${hunk.newCount} @@`),
    );
    for (const op of hunk.ops) {
      if (op.type === "equal") {
        lines.push(` ${op.line}`);
      } else if (op.type === "delete") {
        lines.push(color("red", `-${op.line}`));
      } else {
        lines.push(color("green", `+${op.line}`));
      }
    }
  }

  return lines.join("\n");
}

interface EditOp {
  type: "equal" | "delete" | "insert";
  line: string;
  oldIdx: number;
  newIdx: number;
}

function computeEditOps(oldLines: string[], newLines: string[]): EditOp[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to produce edit ops
  const ops: EditOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: "equal", line: oldLines[i - 1]!, oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ type: "insert", line: newLines[j - 1]!, oldIdx: i, newIdx: j - 1 });
      j--;
    } else {
      ops.push({ type: "delete", line: oldLines[i - 1]!, oldIdx: i - 1, newIdx: j });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  ops: EditOp[];
}

function buildHunks(ops: EditOp[], context: number): Hunk[] {
  // Find ranges of changes, expand by context, merge overlapping
  const changeIndices: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i]!.type !== "equal") changeIndices.push(i);
  }
  if (changeIndices.length === 0) return [];

  // Build ranges with context
  const ranges: Array<[number, number]> = [];
  let start = Math.max(0, changeIndices[0]! - context);
  let end = Math.min(ops.length - 1, changeIndices[0]! + context);

  for (let k = 1; k < changeIndices.length; k++) {
    const cs = Math.max(0, changeIndices[k]! - context);
    const ce = Math.min(ops.length - 1, changeIndices[k]! + context);
    if (cs <= end + 1) {
      end = ce;
    } else {
      ranges.push([start, end]);
      start = cs;
      end = ce;
    }
  }
  ranges.push([start, end]);

  // Convert ranges to hunks
  return ranges.map(([s, e]) => {
    const hunkOps = ops.slice(s, e + 1);
    let oldStart = 0;
    let newStart = 0;
    // Count old/new positions up to hunk start
    for (let i = 0; i < s; i++) {
      if (ops[i]!.type === "equal" || ops[i]!.type === "delete") oldStart++;
      if (ops[i]!.type === "equal" || ops[i]!.type === "insert") newStart++;
    }
    let oldCount = 0;
    let newCount = 0;
    for (const op of hunkOps) {
      if (op.type === "equal" || op.type === "delete") oldCount++;
      if (op.type === "equal" || op.type === "insert") newCount++;
    }
    return { oldStart, newStart, oldCount, newCount, ops: hunkOps };
  });
}
