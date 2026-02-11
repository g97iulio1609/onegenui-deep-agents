import type { FilesystemPort } from "../ports/filesystem.port.js";
import type { Todo } from "../domain/todo.schema.js";
import { TODOS_PATH } from "../tools/planning/shared.js";

/**
 * Returns an async function that checks whether all todos are done.
 * Returns false if no todos exist (don't stop with an empty plan).
 */
export function createAllTodosDoneCondition(
  fs: FilesystemPort,
): () => Promise<boolean> {
  return async () => {
    const exists = await fs.exists(TODOS_PATH, "persistent");
    if (!exists) return false;

    const raw = await fs.read(TODOS_PATH, "persistent");
    const todos: Todo[] = JSON.parse(raw);
    if (todos.length === 0) return false;

    return todos.every((t) => t.status === "done");
  };
}
