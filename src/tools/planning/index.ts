import type { FilesystemPort } from "../../ports/filesystem.port.js";
import { createWriteTodosTool } from "./write-todos.tool.js";
import { createReviewTodosTool } from "./review-todos.tool.js";

export { createWriteTodosTool } from "./write-todos.tool.js";
export { createReviewTodosTool } from "./review-todos.tool.js";

export function createPlanningTools(fs: FilesystemPort) {
  return {
    write_todos: createWriteTodosTool(fs),
    review_todos: createReviewTodosTool(fs),
  };
}
