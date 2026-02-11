import type { TaskToolConfig } from "./task.tool.js";
import { createTaskTool } from "./task.tool.js";
import type { Tool } from "ai";

export { createTaskTool } from "./task.tool.js";
export type { TaskToolConfig } from "./task.tool.js";

interface SubagentToolSet {
  task: ReturnType<typeof createTaskTool>;
}

export function createSubagentTools(config: TaskToolConfig): SubagentToolSet {
  return {
    task: createTaskTool(config),
  };
}
