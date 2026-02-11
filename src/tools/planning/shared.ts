import type { FilesystemPort } from "../../ports/filesystem.port.js";
import type { Todo } from "../../domain/todo.schema.js";

export const TODOS_PATH = "todos.json";

export async function loadTodos(fs: FilesystemPort): Promise<Todo[]> {
  const exists = await fs.exists(TODOS_PATH, "persistent");
  if (!exists) return [];
  const raw = await fs.read(TODOS_PATH, "persistent");
  return JSON.parse(raw) as Todo[];
}
