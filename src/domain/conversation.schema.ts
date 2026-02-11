// =============================================================================
// Conversation Schema — Message types for context management
// =============================================================================

import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.number().optional(),
});

export type MessageType = z.infer<typeof MessageSchema>;

export const CompressedContextSchema = z.object({
  summary: z.string().describe("LLM-generated summary of older messages"),
  originalMessageCount: z
    .number()
    .describe("Number of messages that were summarized"),
  compressedAt: z.number(),
});

export type CompressedContextType = z.infer<typeof CompressedContextSchema>;

export const ConversationStateSchema = z.object({
  sessionId: z.string(),
  messages: z.array(MessageSchema),
  compressedContexts: z
    .array(CompressedContextSchema)
    .default([])
    .describe("Stack of compressed older conversation segments"),
  totalTokensProcessed: z.number().default(0),
});

export type ConversationState = z.infer<typeof ConversationStateSchema>;
