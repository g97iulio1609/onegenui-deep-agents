// =============================================================================
// Tools — Public API (sub-entry point: gauss-ai/tools)
// =============================================================================

// Filesystem tools
export {
  createFilesystemTools,
  createLsTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
} from "./filesystem/index.js";

// Subagent tools
export {
  createAsyncSubagentTools,
  SubagentRegistry,
  SubagentScheduler,
  createDispatchTool,
  createPollTool,
  createAwaitTool,
} from "./subagent/index.js";
export type {
  AsyncSubagentToolsConfig,
  SubagentHandle,
  SubagentTaskStatus,
  SubagentResourceLimits,
  DispatchParams,
  PoolConfig,
} from "./subagent/index.js";

// Planning tools
export {
  createPlanningTools,
  createWriteTodosTool,
  createReviewTodosTool,
  createPlanCreateTool,
  createPlanUpdateTool,
  createPlanStatusTool,
  createPlanVisualizeTool,
  planToGraph,
  type PlanToGraphOptions,
} from "./planning/index.js";

// Policy tools
export { createPolicyTools } from "./policy/index.js";

// LLM Recorder
export { LLMRecorder, LLMReplayer } from "./llm-recorder.js";
export type { LLMCallRecord, RecorderOptions, ReplayerOptions } from "./llm-recorder.js";

// Visual Agent Builder
export { VisualAgentBuilder, ModelRegistry, AgentConfigSchema } from "./visual-agent-builder.js";
export type { AgentConfigJSON, AgentNode, CompiledAgent, AgentBuilderResult } from "./visual-agent-builder.js";
export { AgentBuilderAPI } from "./agent-builder-api.js";
