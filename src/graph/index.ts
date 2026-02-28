// =============================================================================
// Graph — Public API (sub-entry point: gauss-ai/graph)
// =============================================================================

export { AgentGraph, AgentGraphBuilder } from "./agent-graph.js";
export { SharedContext } from "./shared-context.js";
export { GraphExecutor } from "./graph-executor.js";
export type { GraphCheckpoint } from "./graph-executor.js";
export type { AgentNodeConfig, NodeResult } from "./agent-node.js";
export type { GraphConfig, GraphResult, GraphStreamEvent } from "../domain/graph.schema.js";

// Consensus adapters
export { LlmJudgeConsensus } from "../adapters/consensus/llm-judge.adapter.js";
export { MajorityVoteConsensus } from "../adapters/consensus/majority-vote.adapter.js";
export { DebateConsensus } from "../adapters/consensus/debate.adapter.js";

// Visualization adapters
export { AsciiGraphAdapter } from "../adapters/graph-visualization/ascii-graph.adapter.js";
export { MermaidGraphAdapter } from "../adapters/graph-visualization/mermaid-graph.adapter.js";

// Concurrency primitives
export { WorkerPool } from "./worker-pool.js";
export type { WorkerPoolConfig, WorkerPoolMetrics } from "./worker-pool.js";
export { AsyncChannel } from "./async-channel.js";
export { IncrementalReadyTracker } from "./incremental-ready-tracker.js";
export { PriorityQueue } from "./priority-queue.js";
export { TokenBudgetController } from "./token-budget-controller.js";
export type { BudgetStatus } from "./token-budget-controller.js";
export { ForkCoordinator } from "./fork-coordinator.js";

// Supervisor
export { AgentSupervisor } from "./agent-supervisor.js";
export type {
  SupervisorStrategy,
  ChildPolicy,
  ChildSpec,
  RestartIntensity,
  SupervisorConfig,
  ChildStatus,
} from "./agent-supervisor.js";
export { SupervisorBuilder } from "./supervisor-builder.js";

// Dynamic graph
export { DynamicAgentGraph } from "./dynamic-agent-graph.js";
export type { MutationType, MutationEntry, MutationResult } from "./dynamic-agent-graph.js";

// Teams
export { Team, TeamBuilder, team } from "./team-builder.js";
export type {
  CoordinationStrategy,
  TeamMember,
  TeamConfig,
  TeamResult,
  TeamRound,
} from "./team-builder.js";

// Port types
export type { ConsensusPort, ConsensusResult } from "../ports/consensus.port.js";
export type { GraphVisualizationPort, GraphDescriptor } from "../ports/graph-visualization.port.js";
