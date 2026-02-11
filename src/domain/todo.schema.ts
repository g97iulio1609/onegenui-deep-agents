// =============================================================================
// Todo Schema — Planning & task decomposition
// =============================================================================

import { z } from "zod";

export const TodoStatusSchema = z.enum([
  "pending",
  "in_progress",
  "done",
  "blocked",
]);

export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const TodoSchema = z.object({
  id: z.string().describe("Unique identifier for the todo (kebab-case)"),
  title: z.string().describe("Short title of the task"),
  description: z
    .string()
    .optional()
    .describe("Detailed description of what needs to be done"),
  status: TodoStatusSchema.default("pending"),
  dependencies: z
    .array(z.string())
    .default([])
    .describe("IDs of todos this depends on"),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .default("medium")
    .describe("Task priority"),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  completedAt: z.number().optional(),
});

export type Todo = z.infer<typeof TodoSchema>;

export const TodoListSchema = z.array(TodoSchema);

export type TodoList = z.infer<typeof TodoListSchema>;

export const WriteTodosInputSchema = z.object({
  todos: TodoListSchema.describe("List of todos to create or update"),
});

export type WriteTodosInput = z.infer<typeof WriteTodosInputSchema>;

export const UpdateTodoInputSchema = z.object({
  id: z.string().describe("ID of the todo to update"),
  status: TodoStatusSchema.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;
