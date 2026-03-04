/**
 * AgentFactory — Quick agent creation helpers.
 *
 * Provides static factory methods for creating agents with minimal boilerplate.
 *
 * @example
 * ```ts
 * import { AgentFactory } from "gauss-ts";
 *
 * // One-liner
 * const agent = AgentFactory.quick("gpt-4o", "You are a helpful assistant.");
 *
 * // From config object
 * const agent2 = AgentFactory.fromConfig({ model: "gpt-4o", instructions: "Be concise." });
 *
 * // From JSON file
 * const agent3 = await AgentFactory.fromJSON("./agent.json");
 *
 * // From YAML file
 * const agent4 = await AgentFactory.fromYAML("./agent.yaml");
 * ```
 *
 * @since 2.0.0
 */

import { readFile } from "node:fs/promises";
import { Agent } from "./agent.js";
import type { AgentConfig } from "./agent.js";
import type { TypedToolDef } from "./tool.js";

// ─── Types ─────────────────────────────────────────────────────────

/** Options for the quick factory method. */
export interface QuickAgentOptions {
  /** Tool definitions available to the agent. */
  tools?: TypedToolDef[];
  /** Maximum agentic loop iterations. */
  maxSteps?: number;
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Enable memory integration. */
  memoryEnabled?: boolean;
}

// ─── Factory ───────────────────────────────────────────────────────

/**
 * Static factory class for ergonomic agent creation.
 *
 * All methods return fully configured {@link Agent} instances.
 *
 * @since 2.0.0
 */
export class AgentFactory {
  /**
   * Create an agent with minimal configuration.
   *
   * @param model - Model identifier (e.g. `"gpt-4o"`, `"claude-sonnet-4-20250514"`).
   * @param instructions - System instructions for the agent.
   * @param options - Optional additional settings.
   * @returns A configured {@link Agent}.
   *
   * @example
   * ```ts
   * const agent = AgentFactory.quick("gpt-4o", "You are a helpful assistant.");
   * ```
   */
  static quick(model: string, instructions: string, options?: QuickAgentOptions): Agent {
    const config: AgentConfig = {
      model,
      instructions,
      tools: options?.tools,
      maxSteps: options?.maxSteps ?? 10,
      temperature: options?.temperature,
    };
    return new Agent(config);
  }

  /**
   * Create an agent from a full configuration object.
   *
   * @param config - The agent configuration.
   * @returns A configured {@link Agent}.
   *
   * @example
   * ```ts
   * const agent = AgentFactory.fromConfig({
   *   model: "gpt-4o",
   *   instructions: "You are a research assistant.",
   *   temperature: 0.7,
   *   maxSteps: 5,
   * });
   * ```
   */
  static fromConfig(config: AgentConfig): Agent {
    return new Agent(config);
  }

  /**
   * Create an agent from a JSON configuration file.
   *
   * @param path - Path to the JSON file.
   * @returns A configured {@link Agent}.
   * @throws {Error} If the file cannot be read or parsed.
   *
   * @example
   * ```ts
   * const agent = await AgentFactory.fromJSON("./agents/researcher.json");
   * ```
   */
  static async fromJSON(path: string): Promise<Agent> {
    const raw = await readFile(path, "utf-8");
    const config = JSON.parse(raw) as AgentConfig;
    return new Agent(config);
  }

  /**
   * Create an agent from a YAML configuration file.
   *
   * Uses a minimal YAML parser (no external dependencies) that supports
   * the subset needed for agent configuration.
   *
   * @param path - Path to the YAML file.
   * @returns A configured {@link Agent}.
   * @throws {Error} If the file cannot be read or parsed.
   *
   * @example
   * ```ts
   * const agent = await AgentFactory.fromYAML("./agents/researcher.yaml");
   * ```
   */
  static async fromYAML(path: string): Promise<Agent> {
    const raw = await readFile(path, "utf-8");
    const config = parseSimpleYaml(raw) as AgentConfig;
    return new Agent(config);
  }
}

// ─── Minimal YAML Parser ──────────────────────────────────────────

/**
 * Parse a simple YAML string into an object.
 *
 * Supports flat key-value pairs, nested objects (indentation-based),
 * arrays (using `- item` syntax), and scalar coercion (numbers, booleans, null).
 *
 * @internal
 */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.split("\n");
  const result: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: result },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines and comments — compute trimmed once
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;

    // Pop stack to correct level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    // Array item
    if (trimmed.startsWith("- ")) {
      const arrKey = findParentKey(stack);
      if (!arrKey) {
        throw new Error(`Array item at line ${i + 1} has no parent key`);
      }
      const arr = parent[arrKey] as unknown[];
      arr.push(coerceScalar(trimmed.slice(2).trim()));
      continue;
    }

    // Key-value pair
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (value === "" || value === "|" || value === ">") {
      // Check if next line is an array or nested object
      const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
      const nextTrimmed = nextLine.trim();

      if (nextTrimmed.startsWith("- ")) {
        parent[key] = [] as unknown[];
        stack.push({ indent, obj: parent });
      } else {
        const nested: Record<string, unknown> = {};
        parent[key] = nested;
        stack.push({ indent, obj: nested });
      }
    } else {
      parent[key] = coerceScalar(value);
    }
  }

  return result;
}

function findParentKey(
  stack: Array<{ indent: number; obj: Record<string, unknown> }>,
): string | null {
  const parent = stack[stack.length - 1].obj;
  const keys = Object.keys(parent);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (Array.isArray(parent[keys[i]])) return keys[i];
  }
  return null;
}

function coerceScalar(value: string): unknown {
  // Remove surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;

  const num = Number(value);
  if (!Number.isNaN(num) && value !== "") return num;

  return value;
}
