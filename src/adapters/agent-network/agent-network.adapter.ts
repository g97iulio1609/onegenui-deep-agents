// =============================================================================
// Agent Network Adapters — Mesh, Star, Hierarchical topologies
// =============================================================================

import type {
  AgentNetworkPort, NetworkTopology, NetworkAgent,
  DelegationRequest, DelegationResult,
} from "../../ports/agent-network.port.js";

export type DelegationHandler = (request: DelegationRequest) => Promise<unknown>;

export interface AgentNetworkOptions {
  topology: NetworkTopology;
  /** Invoked to actually run a delegation to a specific agent */
  handler: DelegationHandler;
  /** For hierarchical topology: maps agent name → parent name */
  hierarchy?: Record<string, string>;
  /** Default timeout in ms */
  timeout?: number;
}

export class AgentNetworkAdapter implements AgentNetworkPort {
  private registry = new Map<string, NetworkAgent>();
  private opts: Required<Pick<AgentNetworkOptions, "topology" | "handler" | "timeout">> & { hierarchy: Record<string, string> };

  constructor(opts: AgentNetworkOptions) {
    this.opts = {
      topology: opts.topology,
      handler: opts.handler,
      hierarchy: opts.hierarchy ?? {},
      timeout: opts.timeout ?? 30_000,
    };
  }

  register(agent: NetworkAgent): void {
    this.registry.set(agent.name, agent);
  }

  unregister(name: string): void {
    this.registry.delete(name);
  }

  discover(capabilities: string[]): NetworkAgent[] {
    const results: NetworkAgent[] = [];
    for (const agent of this.registry.values()) {
      if (capabilities.every(c => agent.capabilities.includes(c))) {
        results.push(agent);
      }
    }
    return results;
  }

  async delegate(request: DelegationRequest): Promise<DelegationResult> {
    const target = this.registry.get(request.to);
    if (!target) return { success: false, error: `Agent "${request.to}" not found`, duration: 0 };

    // Hierarchical: validate parent→child relationship
    if (this.opts.topology === "hierarchical") {
      const parent = this.opts.hierarchy[request.to];
      if (parent && parent !== request.from) {
        return { success: false, error: `Agent "${request.from}" is not parent of "${request.to}"`, duration: 0 };
      }
    }

    const timeout = request.timeout ?? this.opts.timeout;
    const start = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.opts.handler(request),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Delegation timeout")), timeout);
        }),
      ]);
      return { success: true, result, duration: Date.now() - start };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), duration: Date.now() - start };
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  async broadcast(task: string, capabilities: string[], context?: Record<string, unknown>): Promise<DelegationResult[]> {
    const targets = this.discover(capabilities);
    const results = await Promise.allSettled(
      targets.map(agent =>
        this.delegate({ from: "__broadcast__", to: agent.name, task, context }),
      ),
    );
    return results.map(r =>
      r.status === "fulfilled" ? r.value : { success: false, error: r.reason?.message ?? "Unknown error", duration: 0 },
    );
  }

  topology(): NetworkTopology {
    return this.opts.topology;
  }

  agents(): NetworkAgent[] {
    return [...this.registry.values()];
  }
}
