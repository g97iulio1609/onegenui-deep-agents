// =============================================================================
// CLI Graph Command — Visualize agent graphs from config files
// =============================================================================

import { readFileSync } from "node:fs";
import type { GraphDescriptor } from "../../ports/graph-visualization.port.js";
import { color, bold } from "../format.js";

export async function graphCommand(
  configPath: string,
  format: "ascii" | "mermaid",
): Promise<void> {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(color("red", `✗ Failed to read config: ${msg}`));
    process.exitCode = 1;
    return;
  }

  let descriptor: GraphDescriptor;
  try {
    descriptor = JSON.parse(raw) as GraphDescriptor;
  } catch {
    console.error(color("red", "✗ Invalid JSON in config file."));
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(descriptor.nodes) || !Array.isArray(descriptor.edges)) {
    console.error(color("red", "✗ Config must contain 'nodes' and 'edges' arrays."));
    process.exitCode = 1;
    return;
  }

  // Default forks to empty array if missing
  if (!Array.isArray(descriptor.forks)) {
    descriptor.forks = [];
  }

  if (format === "mermaid") {
    const { MermaidGraphAdapter } = await import(
      "../../adapters/graph-visualization/index.js"
    );
    const adapter = new MermaidGraphAdapter();
    console.log(bold("\nMermaid Graph:\n"));
    console.log(adapter.toMermaid(descriptor));
  } else {
    const { AsciiGraphAdapter } = await import(
      "../../adapters/graph-visualization/index.js"
    );
    const adapter = new AsciiGraphAdapter();
    console.log(bold("\nAgent Graph:\n"));
    console.log(adapter.toAscii(descriptor));
  }

  console.log();
}
