#!/usr/bin/env node
// =============================================================================
// Gauss Rename Script — Full automated refactoring
// =============================================================================
// Usage: node scripts/rename.mjs [--dry-run]
//
// Renames:
//   Agent → Agent, AgentBuilder → AgentBuilder, Plugin → Plugin
//   AgentConfig → AgentConfig, GaussServer → GaussServer
//   GaussError → GaussError, GaussMcpAdapter → GaussMcpAdapter
//   GaussConfig → GaussConfig, Gauss → Gauss (branding strings)
//   File renames: deep-agent.ts → agent.ts, etc.
//   Import path updates, package.json name update
//   External package refs: gauss → gauss (comments only)
//   NOTE: @giulio-leone/gaussflow-mcp is an EXTERNAL dep — left untouched

import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = process.cwd();

// ─── Config ──────────────────────────────────────────────────────────────────

/** File renames: [oldRelPath, newRelPath] */
const FILE_RENAMES = [
  ["src/agent/deep-agent.ts", "src/agent/agent.ts"],
  ["src/agent/deep-agent-builder.ts", "src/agent/agent-builder.ts"],
  ["src/adapters/mcp/gaussflow-mcp.adapter.ts", "src/adapters/mcp/gauss-mcp.adapter.ts"],
  ["src/cli/gaussflow-ignore.ts", "src/cli/gauss-ignore.ts"],
  ["src/__tests__/deep-agent.test.ts", "src/__tests__/agent.test.ts"],
  ["src/__tests__/deep-agent.plugins.test.ts", "src/__tests__/agent.plugins.test.ts"],
];

/** 
 * Ordered replacement rules for file content.
 * Each rule: [regex, replacement]
 * Order matters: longer/more-specific patterns first.
 * We use functions for some replacements to handle context.
 */
function buildRules() {
  const rules = [];

  // ── Import path renames (must run BEFORE symbol renames) ──────────────
  // deep-agent-builder → agent-builder
  rules.push([
    /(\bfrom\s+["'][^"']*\/)deep-agent-builder(\.js)?(?=["'])/g,
    "$1agent-builder$2"
  ]);
  rules.push([
    /(import\(["'][^"']*\/)deep-agent-builder(\.js)?(?=["'])/g,
    "$1agent-builder$2"
  ]);

  // deep-agent → agent (in import paths — after builder to avoid mangling)
  rules.push([
    /(\bfrom\s+["'][^"']*\/)deep-agent(\.js)?(?=["'])/g,
    "$1agent$2"
  ]);
  rules.push([
    /(import\(["'][^"']*\/)deep-agent(\.js)?(?=["'])/g,
    "$1agent$2"
  ]);

  // gaussflow-mcp.adapter → gauss-mcp.adapter
  rules.push([
    /(\bfrom\s+["'][^"']*\/)gaussflow-mcp\.adapter(\.js)?(?=["'])/g,
    "$1gauss-mcp.adapter$2"
  ]);
  rules.push([
    /(export\s+\{[^}]*\}\s+from\s+["'][^"']*\/)gaussflow-mcp\.adapter(\.js)?(?=["'])/g,
    "$1gauss-mcp.adapter$2"
  ]);

  // gaussflow-ignore → gauss-ignore
  rules.push([
    /(\bfrom\s+["'][^"']*\/)gaussflow-ignore(\.js)?(?=["'])/g,
    "$1gauss-ignore$2"
  ]);
  rules.push([
    /(import\(["'][^"']*\/)gaussflow-ignore(\.js)?(?=["'])/g,
    "$1gauss-ignore$2"
  ]);

  // ── Symbol renames (longest first) ────────────────────────────────────
  rules.push([/\bDeepAgentBuilder\b/g, "AgentBuilder"]);
  rules.push([/\bDeepAgentPlugin\b/g, "Plugin"]);
  rules.push([/\bDeepAgentConfig\b/g, "AgentConfig"]);
  rules.push([/\bDeepAgentResult\b/g, "AgentResult"]);
  rules.push([/\bDeepAgentRunOptions\b/g, "AgentRunOptions"]);
  rules.push([/\bDeepAgent\b/g, "Agent"]);

  rules.push([/\bGaussMcpAdapter\b/g, "GaussMcpAdapter"]);
  rules.push([/\bGaussServer\b/g, "GaussServer"]);
  rules.push([/\bGaussError\b/g, "GaussError"]);
  rules.push([/\bGaussConfig\b/g, "GaussConfig"]);

  // ── Branding strings ──────────────────────────────────────────────────
  // gauss → gauss (in comments, not in actual imports of external pkgs)
  rules.push([/@giulio-leone\/gaussflow-agent/g, "gauss"]);

  // "Gauss" in user-facing strings → "Gauss" (but not inside @giulio-leone/gaussflow-mcp)
  // We need a negative lookbehind to avoid touching the external package name
  rules.push([/(?<!@giulio-leone\/)Gauss(?!-mcp)/g, "Gauss"]);

  return rules;
}

/** Directories to skip */
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "packages", "logs"]);

/** File extensions to process */
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

let filesModified = 0;
let filesRenamed = 0;
let totalReplacements = 0;

function getAllFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...getAllFiles(fullPath));
    } else {
      const ext = "." + entry.name.split(".").pop();
      if (EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`\n🔄 Gauss Rename Script ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

// ── Step 1: Rename files ────────────────────────────────────────────────────
console.log("📁 Step 1: Renaming files...");
for (const [oldRel, newRel] of FILE_RENAMES) {
  const oldPath = join(ROOT, oldRel);
  const newPath = join(ROOT, newRel);
  if (!existsSync(oldPath)) {
    console.log(`   ⚠️  Skip (not found): ${oldRel}`);
    continue;
  }
  if (existsSync(newPath)) {
    console.log(`   ⚠️  Skip (target exists): ${newRel}`);
    continue;
  }
  console.log(`   ${oldRel} → ${newRel}`);
  if (!DRY_RUN) renameSync(oldPath, newPath);
  filesRenamed++;
}

// ── Step 2: Replace content ─────────────────────────────────────────────────
const rules = buildRules();
const files = getAllFiles(ROOT);
console.log(`\n📝 Step 2: Processing ${files.length} files...`);

for (const filePath of files) {
  const relPath = relative(ROOT, filePath);

  // Skip the type declaration for the external MCP package
  if (relPath === "src/types/gaussflow-mcp.d.ts") {
    console.log(`   ⏭️  Skipped (external type decl): ${relPath}`);
    continue;
  }

  try {
    const original = readFileSync(filePath, "utf-8");
    let modified = original;
    let count = 0;

    for (const [pattern, replacement] of rules) {
      const before = modified;
      // Reset lastIndex for sticky regexes
      pattern.lastIndex = 0;
      modified = modified.replace(pattern, replacement);
      if (modified !== before) {
        pattern.lastIndex = 0;
        const matches = (before.match(pattern) || []).length;
        count += matches;
      }
    }

    if (count > 0) {
      console.log(`   ✏️  ${relPath} (${count} replacements)`);
      if (!DRY_RUN) writeFileSync(filePath, modified, "utf-8");
      filesModified++;
      totalReplacements += count;
    }
  } catch (err) {
    console.log(`   ❌ Error: ${relPath}: ${err.message}`);
  }
}

// ── Step 3: Update package.json ─────────────────────────────────────────────
console.log("\n📦 Step 3: Updating package.json...");
const pkgPath = join(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const oldName = pkg.name;
pkg.name = "gauss";
// Also update description if it references Gauss
if (pkg.description) {
  pkg.description = pkg.description.replace(/Gauss/g, "Gauss");
}
console.log(`   name: "${oldName}" → "gauss"`);
if (!DRY_RUN) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

// ── Step 4: Add backward compat aliases to index.ts ─────────────────────────
console.log("\n🔗 Step 4: Adding backward-compat aliases to src/index.ts...");
const indexPath = join(ROOT, "src/index.ts");
let indexContent = readFileSync(indexPath, "utf-8");

const backwardCompat = `
// ── Backward Compatibility Aliases (deprecated) ─────────────────────────────
// These aliases preserve backward compatibility with pre-v2.0 imports.
// They will be removed in a future major version.

/** @deprecated Use \`Agent\` instead */
export { Agent as Agent } from "./agent/agent.js";
/** @deprecated Use \`AgentBuilder\` instead */
export { AgentBuilder as AgentBuilder } from "./agent/agent-builder.js";
/** @deprecated Use \`AgentResult\` instead */
export type { AgentResult as AgentResult } from "./agent/agent.js";
/** @deprecated Use \`AgentRunOptions\` instead */
export type { AgentRunOptions as AgentRunOptions } from "./agent/agent.js";
/** @deprecated Use \`Plugin\` instead */
export type { Plugin as Plugin } from "./ports/plugin.port.js";
/** @deprecated Use \`AgentConfig\` instead */
export type { AgentConfig as AgentConfig } from "./types.js";
/** @deprecated Use \`GaussError\` instead */
export { GaussError as GaussError } from "./errors/index.js";
/** @deprecated Use \`GaussServer\` instead */
export { GaussServer as GaussServer } from "./rest/server.js";
/** @deprecated Use \`GaussMcpAdapter\` instead */
export { GaussMcpAdapter as GaussMcpAdapter } from "./adapters/mcp/gauss-mcp.adapter.js";
/** @deprecated Use \`GaussConfig\` instead */
export type { GaussConfig as GaussConfig } from "./cli/config.js";
`;

if (!indexContent.includes("Backward Compatibility Aliases")) {
  if (!DRY_RUN) {
    writeFileSync(indexPath, indexContent + backwardCompat, "utf-8");
  }
  console.log("   ✅ Added backward compat aliases");
} else {
  console.log("   ⏭️  Aliases already present");
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`
${"═".repeat(60)}
✅ Rename complete!
   Files renamed:    ${filesRenamed}
   Files modified:   ${filesModified}
   Replacements:     ${totalReplacements}
   Package name:     ${oldName} → gauss
   Backward compat:  Added to src/index.ts
${"═".repeat(60)}
${DRY_RUN ? "\n⚠️  DRY RUN — no files were actually changed.\n" : ""}
📌 Next steps:
   1. npx vitest run    — verify tests pass
   2. npx tsup          — verify DTS build
   3. git add -A && git commit
`);
