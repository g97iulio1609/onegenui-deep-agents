// =============================================================================
// AgentNetworkPort — Multi-agent coordination contract
// =============================================================================

export type NetworkTopology = "mesh" | "star" | "hierarchical";

export interface NetworkAgent {
  name: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface DelegationRequest {
  from: string;
  to: string;
  task: string;
  context?: Record<string, unknown>;
  timeout?: number;
}

export interface DelegationResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface AgentNetworkPort {
  /** Register an agent in the network */
  register(agent: NetworkAgent): void;

  /** Unregister an agent */
  unregister(name: string): void;

  /** Discover agents matching capabilities */
  discover(capabilities: string[]): NetworkAgent[];

  /** Delegate a task to a specific agent */
  delegate(request: DelegationRequest): Promise<DelegationResult>;

  /** Broadcast a task to all agents matching capabilities */
  broadcast(task: string, capabilities: string[], context?: Record<string, unknown>): Promise<DelegationResult[]>;

  /** Get network topology */
  topology(): NetworkTopology;

  /** List all registered agents */
  agents(): NetworkAgent[];
}
