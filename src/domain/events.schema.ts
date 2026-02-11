// =============================================================================
// Events Schema — Agent lifecycle events
// =============================================================================

import { z } from "zod";

export const AgentEventTypeSchema = z.enum([
  "agent:start",
  "agent:stop",
  "step:start",
  "step:end",
  "tool:call",
  "tool:result",
  "tool:approval-required",
  "tool:approved",
  "tool:denied",
  "checkpoint:save",
  "checkpoint:load",
  "context:summarize",
  "context:offload",
  "context:truncate",
  "subagent:spawn",
  "subagent:complete",
  "planning:update",
  "error",
]);

export type AgentEventTypeValue = z.infer<typeof AgentEventTypeSchema>;

export const AgentEventSchema = z.object({
  type: AgentEventTypeSchema,
  timestamp: z.number(),
  sessionId: z.string(),
  data: z.unknown(),
});

export type AgentEventValue = z.infer<typeof AgentEventSchema>;
