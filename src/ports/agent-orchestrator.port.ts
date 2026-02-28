// =============================================================================
// AgentOrchestrator Port — Production-grade multi-agent orchestration patterns
// =============================================================================

export type OrchestrationPattern =
  | "supervisor"
  | "swarm"
  | "pipeline"
  | "map-reduce"
  | "debate";

export interface AgentOrchestratorPort {
  createOrchestration(config: OrchestrationConfig): Orchestration;
}

export interface OrchestrationConfig {
  pattern: OrchestrationPattern;
  agents: OrchestrationAgent[];
  options?: OrchestrationOptions;
}

export interface OrchestrationAgent {
  id: string;
  role: string;
  instructions: string;
  execute: (input: OrchestrationMessage) => Promise<OrchestrationMessage>;
}

export interface OrchestrationMessage {
  from: string;
  to?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface OrchestrationOptions {
  maxRounds?: number;
  timeout?: number;
  supervisor?: {
    delegationStrategy: "round-robin" | "capability-based" | "load-balanced";
    aggregationStrategy: "concat" | "summarize" | "vote";
  };
  swarm?: {
    blackboard: Map<string, unknown>;
    convergenceCheck?: (messages: OrchestrationMessage[]) => boolean;
  };
  pipeline?: {
    errorStrategy: "stop" | "skip" | "retry";
    retryCount?: number;
  };
  mapReduce?: {
    splitFn: (input: string) => string[];
    reduceFn: (
      results: OrchestrationMessage[],
    ) => OrchestrationMessage;
    concurrency?: number;
  };
  debate?: {
    rounds: number;
    judgeAgentId: string;
    votingStrategy: "judge" | "majority" | "unanimous";
  };
}

export interface Orchestration {
  id: string;
  pattern: OrchestrationPattern;

  execute(input: string): Promise<OrchestrationResult>;

  /** Stream execution events */
  stream(input: string): AsyncIterable<OrchestrationEvent>;

  /** Cancel a running orchestration */
  cancel(): void;
}

export interface OrchestrationResult {
  output: string;
  messages: OrchestrationMessage[];
  pattern: OrchestrationPattern;
  agentResults: Map<string, OrchestrationMessage[]>;
  durationMs: number;
  rounds: number;
}

export interface OrchestrationEvent {
  type:
    | "agent_start"
    | "agent_end"
    | "message"
    | "round_start"
    | "round_end"
    | "error"
    | "complete";
  agentId?: string;
  message?: OrchestrationMessage;
  round?: number;
  error?: Error;
  result?: OrchestrationResult;
}
