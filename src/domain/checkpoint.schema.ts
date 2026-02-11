// =============================================================================
// Checkpoint Schema — State serialization for resume
// =============================================================================

import { z } from "zod";
import { TodoSchema } from "./todo.schema.js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.number().optional(),
});

export const CheckpointSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  stepIndex: z.number(),
  conversation: z.array(MessageSchema),
  todos: z.array(TodoSchema).default([]),
  filesSnapshot: z
    .record(z.string(), z.string())
    .default({})
    .describe("Map of path → content for files in VFS persistent zone"),
  toolResults: z.record(z.string(), z.unknown()).default({}),
  generatedTokens: z.number().default(0),
  lastToolCallId: z.string().nullable().default(null),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number().default(() => Date.now()),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;
