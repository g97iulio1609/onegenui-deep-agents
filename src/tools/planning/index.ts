import type { FilesystemPort } from "../../ports/filesystem.port.js";
import { createWriteTodosTool } from "./write-todos.tool.js";
import { createReviewTodosTool } from "./review-todos.tool.js";
import { createPlanCreateTool } from "./plan-create.tool.js";
import { createPlanUpdateTool } from "./plan-update.tool.js";
import { createPlanStatusTool } from "./plan-status.tool.js";
import { createPlanVisualizeTool } from "./plan-visualize.tool.js";

// Legacy tools (retrocompatibilità)
export { createWriteTodosTool } from "./write-todos.tool.js";
export { createReviewTodosTool } from "./review-todos.tool.js";

// Structured plan tools
export { createPlanCreateTool } from "./plan-create.tool.js";
export { createPlanUpdateTool } from "./plan-update.tool.js";
export { createPlanStatusTool } from "./plan-status.tool.js";
export { createPlanVisualizeTool } from "./plan-visualize.tool.js";

// Plan-to-Graph converter
export { planToGraph, type PlanToGraphOptions } from "./plan-to-graph.js";

/**
 * Crea tutti i tool di planning (legacy + structured).
 * I vecchi write_todos/review_todos coesistono con i nuovi plan_* tools.
 */
export function createPlanningTools(fs: FilesystemPort) {
  return {
    // Legacy (retrocompatibilità)
    write_todos: createWriteTodosTool(fs),
    review_todos: createReviewTodosTool(fs),
    // Structured planning
    plan_create: createPlanCreateTool(fs),
    plan_update: createPlanUpdateTool(fs),
    plan_status: createPlanStatusTool(fs),
    plan_visualize: createPlanVisualizeTool(fs),
  };
}
