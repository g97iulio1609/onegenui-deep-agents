// =============================================================================
// CLI File Operations — Read, write, and check file existence
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function readFile(filePath: string): { content: string; path: string } {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) throw new Error(`File not found: ${absPath}`);
  return { content: readFileSync(absPath, "utf-8"), path: absPath };
}

export function writeFile(filePath: string, content: string): string {
  const absPath = resolve(filePath);
  writeFileSync(absPath, content, "utf-8");
  return absPath;
}

export function fileExists(filePath: string): boolean {
  return existsSync(resolve(filePath));
}
