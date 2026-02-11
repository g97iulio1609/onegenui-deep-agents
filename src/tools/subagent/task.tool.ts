// =============================================================================
// Task Tool — Spawns a subagent to handle a complex subtask
// =============================================================================

import { tool, ToolLoopAgent, stepCountIs } from "ai";
import type { LanguageModel, Tool } from "ai";
import { z } from "zod";

import type { FilesystemPort } from "../../ports/filesystem.port.js";
import { VirtualFilesystem } from "../../adapters/filesystem/virtual-fs.adapter.js";
import { createFilesystemTools } from "../filesystem/index.js";

export interface TaskToolConfig {
  parentModel: LanguageModel;
  parentFilesystem: FilesystemPort;
  maxDepth?: number;
  timeoutMs?: number;
  currentDepth?: number;
}

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_STEPS = 20;
const DEFAULT_INSTRUCTIONS =
  "You are a specialized subagent. Complete the task and return your findings.";

const taskInputSchema = z.object({
  prompt: z.string().describe("Task description for the subagent"),
  instructions: z
    .string()
    .optional()
    .describe("Optional system instructions"),
  tools: z
    .array(z.string())
    .optional()
    .describe("Optional list of tool names to include from parent"),
});

type TaskInput = z.infer<typeof taskInputSchema>;
type TaskTool = Tool<TaskInput, string>;

export function createTaskTool(config: TaskToolConfig): TaskTool {
  const {
    parentModel,
    maxDepth = DEFAULT_MAX_DEPTH,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    currentDepth = 0,
  } = config;

  return tool({
    description:
      "Spawn a specialized subagent to handle a complex subtask. " +
      "The subagent runs independently with its own context.",
    inputSchema: taskInputSchema,
    execute: async ({ prompt, instructions }): Promise<string> => {
      if (currentDepth >= maxDepth) {
        return `[Error] Maximum subagent depth (${maxDepth}) reached. Cannot spawn further subagents.`;
      }

      const subVfs = new VirtualFilesystem();
      const fsTools = createFilesystemTools(subVfs);

      const nestedTaskTool: TaskTool = createTaskTool({
        parentModel,
        parentFilesystem: subVfs,
        maxDepth,
        timeoutMs,
        currentDepth: currentDepth + 1,
      });

      const agent = new ToolLoopAgent({
        model: parentModel,
        instructions: instructions ?? DEFAULT_INSTRUCTIONS,
        tools: { ...fsTools, task: nestedTaskTool },
        stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
      });

      let timer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Subagent timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      try {
        const result = await Promise.race([
          agent.generate({ prompt }),
          timeoutPromise,
        ]);
        return result.text || "[Subagent completed with no text output]";
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        return `[Error] Subagent failed: ${message}`;
      } finally {
        clearTimeout(timer!);
      }
    },
  });
}
