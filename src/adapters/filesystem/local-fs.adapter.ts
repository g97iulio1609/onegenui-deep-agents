// =============================================================================
// LocalFilesystem — Sandboxed wrapper over Node.js fs
// =============================================================================

import {
  readFile,
  writeFile,
  mkdir,
  rm,
  readdir,
  stat as fsStat,
} from "node:fs/promises";
import { join, resolve, relative } from "node:path";

import type { FilesystemPort } from "../../ports/filesystem.port.js";
import type {
  FileEntry,
  FileStat,
  FilesystemZone,
  ListOptions,
  SearchOptions,
  SearchResult,
} from "../../types.js";
import { globToRegex } from "./glob-utils.js";

export class LocalFilesystem implements FilesystemPort {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  async read(path: string, zone: FilesystemZone = "transient"): Promise<string> {
    return readFile(this.resolvePath(path, zone), "utf-8");
  }

  async write(path: string, content: string, zone: FilesystemZone = "transient"): Promise<void> {
    const fullPath = this.resolvePath(path, zone);
    await mkdir(resolve(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  async exists(path: string, zone: FilesystemZone = "transient"): Promise<boolean> {
    try {
      await fsStat(this.resolvePath(path, zone));
      return true;
    } catch {
      return false;
    }
  }

  async delete(path: string, zone: FilesystemZone = "transient"): Promise<void> {
    await rm(this.resolvePath(path, zone), { recursive: true, force: true });
  }

  async list(
    path: string,
    options: ListOptions = {},
    zone: FilesystemZone = "transient",
  ): Promise<FileEntry[]> {
    const fullPath = this.resolvePath(path, zone);
    return this.readEntries(fullPath, fullPath, options, 1);
  }

  async stat(path: string, zone: FilesystemZone = "transient"): Promise<FileStat> {
    const s = await fsStat(this.resolvePath(path, zone));
    return {
      size: s.size,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      createdAt: s.birthtimeMs,
      modifiedAt: s.mtimeMs,
    };
  }

  async glob(pattern: string, zone: FilesystemZone = "transient"): Promise<string[]> {
    const zoneRoot = this.zoneRoot(zone);
    const allFiles = await this.collectFiles(zoneRoot);
    const regex = globToRegex(pattern);
    return allFiles
      .map((f) => relative(zoneRoot, f).split("\\").join("/"))
      .filter((f) => regex.test(f));
  }

  async search(
    pattern: string,
    options: SearchOptions = {},
    zone: FilesystemZone = "transient",
  ): Promise<SearchResult[]> {
    const zoneRoot = this.zoneRoot(zone);
    const allFiles = await this.collectFiles(zoneRoot);
    const flags = options.caseSensitive === false ? "gi" : "g";
    const regex = new RegExp(pattern, flags);
    const fileRegex = options.filePattern ? globToRegex(options.filePattern) : null;
    const max = options.maxResults ?? Infinity;
    const results: SearchResult[] = [];

    for (const absPath of allFiles) {
      const relPath = relative(zoneRoot, absPath).split("\\").join("/");
      if (fileRegex && !fileRegex.test(relPath)) continue;
      const content = await readFile(absPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length && results.length < max; i++) {
        regex.lastIndex = 0;
        const match = regex.exec(lines[i]!);
        if (match) {
          results.push({
            filePath: relPath,
            lineNumber: i + 1,
            lineContent: lines[i]!,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
        }
      }
      if (results.length >= max) break;
    }
    return results;
  }

  private zoneRoot(zone: FilesystemZone): string {
    return join(this.basePath, zone);
  }

  private resolvePath(path: string, zone: FilesystemZone): string {
    const zoneRoot = this.zoneRoot(zone);
    const resolved = resolve(zoneRoot, path);
    const rel = relative(zoneRoot, resolved);
    if (rel.startsWith("..") || resolve(resolved) === resolve(zoneRoot, "..", rel)) {
      throw new Error(`Path traversal denied: ${path}`);
    }
    return resolved;
  }

  private async readEntries(
    dir: string,
    rootDir: string,
    options: ListOptions,
    depth: number,
  ): Promise<FileEntry[]> {
    const maxDepth = options.maxDepth ?? (options.recursive ? Infinity : 1);
    if (depth > maxDepth) return [];
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const results: FileEntry[] = [];
    for (const entry of entries) {
      if (!options.includeHidden && entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath).split("\\").join("/");
      const s = await fsStat(fullPath);
      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: entry.isDirectory(),
        size: s.size,
        modifiedAt: s.mtimeMs,
      });
      if (entry.isDirectory() && options.recursive) {
        const children = await this.readEntries(fullPath, rootDir, options, depth + 1);
        results.push(...children);
      }
    }
    return results;
  }

  private async collectFiles(dir: string): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.collectFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }
}


