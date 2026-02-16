// =============================================================================
// CLI Plugin Command — Plugin marketplace management
// =============================================================================

import { color, bold } from "../format.js";
import { GitHubRegistryAdapter } from "../../adapters/plugin-marketplace/index.js";

function createRegistry(): GitHubRegistryAdapter {
  return new GitHubRegistryAdapter();
}

export async function pluginSearch(query: string): Promise<void> {
  const registry = createRegistry();

  console.log(color("dim", `\nSearching for "${query}"...\n`));

  let results;
  try {
    results = await registry.search(query);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(color("red", `✗ Search failed: ${msg}`));
    process.exitCode = 1;
    return;
  }

  if (results.length === 0) {
    console.log(color("yellow", "  No plugins found.\n"));
    return;
  }

  console.log(bold(`  Found ${results.length} plugin(s):\n`));
  for (const plugin of results) {
    console.log(`  ${bold(color("cyan", plugin.name))} ${color("dim", `v${plugin.version}`)}`);
    console.log(`    ${plugin.description}`);
    console.log(`    ${color("dim", `by ${plugin.author}`)}${plugin.tags?.length ? ` ${color("dim", `[${plugin.tags.join(", ")}]`)}` : ""}`);
    console.log();
  }
}

export async function pluginInstall(name: string): Promise<void> {
  const registry = createRegistry();

  console.log(color("dim", `\nInstalling plugin "${name}"...\n`));

  try {
    await registry.install(name);
    console.log(color("green", `  ✓ Plugin "${name}" installed successfully.\n`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(color("red", `  ✗ Install failed: ${msg}\n`));
    process.exitCode = 1;
  }
}

export async function pluginUninstall(name: string): Promise<void> {
  const registry = createRegistry();

  try {
    await registry.uninstall(name);
    console.log(color("green", `\n  ✓ Plugin "${name}" uninstalled.\n`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(color("red", `\n  ✗ Uninstall failed: ${msg}\n`));
    process.exitCode = 1;
  }
}

export async function pluginList(): Promise<void> {
  const registry = createRegistry();

  let installed;
  try {
    installed = await registry.listInstalled();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(color("red", `\n✗ Failed to list plugins: ${msg}`));
    process.exitCode = 1;
    return;
  }

  if (installed.length === 0) {
    console.log(color("dim", "\n  No plugins installed.\n"));
    return;
  }

  console.log(bold(`\n  Installed plugins (${installed.length}):\n`));
  for (const plugin of installed) {
    console.log(`  ${bold(color("cyan", plugin.name))} ${color("dim", `v${plugin.version}`)}`);
    console.log(`    ${plugin.description}`);
    console.log(`    ${color("dim", `by ${plugin.author}`)}`);
    console.log();
  }
}
