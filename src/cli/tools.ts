// =============================================================================
// CLI Tools — AI-driven tool definitions for agentic mode
// =============================================================================

import { z } from "zod";
import { tool } from "ai";
import { readFileSync, readdirSync, realpathSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { readFile, writeFile } from "./commands/files.js";
import { runBash } from "./commands/bash.js";
import { generateUnifiedDiff } from "./diff-utils.js";

function listDir(dirPath: string, pattern?: string): string[] {
  const absDir = resolve(dirPath);
  const results: string[] = [];
  try {
    const entries = readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (pattern && !entry.name.includes(pattern)) continue;
      const rel = relative(process.cwd(), join(absDir, entry.name));
      results.push(entry.isDirectory() ? `${rel}/` : rel);
    }
  } catch {
    // directory not readable
  }
  return results.slice(0, 50);
}

function searchInFiles(searchPattern: string, dirPath: string, maxResults = 50): string[] {
  const absDir = resolve(dirPath);
  const results: string[] = [];
  const visited = new Set<string>();
  const MAX_DEPTH = 10;

  function walk(dir: string, depth: number): void {
    if (results.length >= maxResults || depth > MAX_DEPTH) return;
    try {
      const realDir = realpathSync(dir);
      if (visited.has(realDir)) return;
      visited.add(realDir);

      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = join(dir, entry.name);
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const content = readFileSync(fullPath, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (lines[i]!.includes(searchPattern)) {
                results.push(`${relative(process.cwd(), fullPath)}:${i + 1}:${lines[i]}`);
                if (results.length >= maxResults) return;
              }
            }
          } catch {
            // skip binary or unreadable files
          }
        }
      }
    } catch {
      // directory not readable
    }
  }

  walk(absDir, 0);
  return results;
}

export function createCliTools(options: {
  yolo: boolean;
  confirm: (description: string) => Promise<boolean>;
}) {
  return {
    readFile: tool({
      description: "Read a file from the filesystem",
      parameters: z.object({
        path: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ path }) => {
        const result = readFile(path);
        return { content: result.content, path: result.path };
      },
    }),
    writeFile: tool({
      description: "Write content to a file (creates or overwrites)",
      parameters: z.object({
        path: z.string().describe("Path to write to"),
        content: z.string().describe("Content to write"),
      }),
      execute: async ({ path, content }) => {
        if (!options.yolo) {
          const absPath = resolve(path);
          let desc: string;
          if (existsSync(absPath)) {
            const existing = readFileSync(absPath, "utf-8");
            const diff = generateUnifiedDiff(existing, content, path);
            const diffLines = diff.split("\n");
            const preview = diffLines.length > 30
              ? diffLines.slice(0, 30).join("\n") + "\n..."
              : diff;
            desc = `Write to ${path}\n${preview}`;
          } else {
            const lineCount = content.split("\n").length;
            desc = `Write to ${path} (new file, ${lineCount} lines)`;
          }
          const ok = await options.confirm(desc);
          if (!ok) return { error: "User cancelled" };
        }
        const absPath = writeFile(path, content);
        return { path: absPath, bytesWritten: content.length };
      },
    }),
    bash: tool({
      description: "Execute a bash command",
      parameters: z.object({
        command: z.string().describe("The bash command to execute"),
      }),
      execute: async ({ command }) => {
        if (!options.yolo) {
          const ok = await options.confirm(`Run: ${command}`);
          if (!ok) return { error: "User cancelled" };
        }
        return runBash(command);
      },
    }),
    listFiles: tool({
      description: "List files in a directory",
      parameters: z.object({
        path: z.string().describe("Directory path").default("."),
        pattern: z.string().describe("Filename substring filter").optional(),
      }),
      execute: async ({ path, pattern }) => {
        const files = listDir(path, pattern);
        return { files, count: files.length };
      },
    }),
    searchFiles: tool({
      description: "Search for a text pattern in files (recursive)",
      parameters: z.object({
        pattern: z.string().describe("The text pattern to search for"),
        path: z.string().describe("Directory to search in").default("."),
      }),
      execute: async ({ pattern, path }) => {
        const matches = searchInFiles(pattern, path);
        return { matches, count: matches.length };
      },
    }),
    editFile: tool({
      description:
        "Edit a file by replacing specific text. Use this instead of writeFile when making targeted changes to existing files. The old_str must match exactly one occurrence in the file.",
      parameters: z.object({
        path: z.string().describe("Path to the file to edit"),
        old_str: z.string().min(1).describe("The exact text to find and replace (must match exactly one occurrence)"),
        new_str: z.string().describe("The replacement text"),
      }),
      execute: async ({ path, old_str, new_str }) => {
        let content: string;
        try {
          content = readFile(path).content;
        } catch (err) {
          return { error: `Failed to read file: ${(err as Error).message}` };
        }

        // Count occurrences
        let count = 0;
        let idx = 0;
        while ((idx = content.indexOf(old_str, idx)) !== -1) {
          count++;
          idx += old_str.length;
        }

        if (count === 0) {
          return { error: `old_str not found in ${path}` };
        }
        if (count > 1) {
          return { error: `old_str found ${count} times in ${path} — must match exactly once` };
        }

        const replaceIdx = content.indexOf(old_str);
        const newContent = content.slice(0, replaceIdx) + new_str + content.slice(replaceIdx + old_str.length);
        const diff = generateUnifiedDiff(content, newContent, path);

        if (!options.yolo) {
          const ok = await options.confirm(`Edit ${path}\n${diff}`);
          if (!ok) return { error: "User cancelled" };
        }

        const absPath = writeFile(path, newContent);
        return { path: absPath };
      },
    }),
    createFile: tool({
      description: "Create a new file. Fails if the file already exists. Use editFile for existing files.",
      parameters: z.object({
        path: z.string().describe("Path for the new file"),
        content: z.string().describe("Content for the new file"),
      }),
      execute: async ({ path, content }) => {
        const absPath = resolve(path);
        if (existsSync(absPath)) {
          return { error: `File already exists: ${absPath}. Use editFile to modify it.` };
        }

        if (!options.yolo) {
          const lineCount = content.split("\n").length;
          const ok = await options.confirm(`Create ${path} (${lineCount} lines)`);
          if (!ok) return { error: "User cancelled" };
        }

        const written = writeFile(path, content);
        return { path: written, bytesWritten: content.length };
      },
    }),
  };
}
