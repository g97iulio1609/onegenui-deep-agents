// =============================================================================
// AgentOrchestratorAdapter — Main adapter implementing AgentOrchestratorPort
// =============================================================================

import type {
  AgentOrchestratorPort,
  Orchestration,
  OrchestrationConfig,
} from "../../ports/agent-orchestrator.port.js";

import { createSupervisorOrchestration } from "./patterns/supervisor.js";
import { createSwarmOrchestration } from "./patterns/swarm.js";
import { createPipelineOrchestration } from "./patterns/pipeline.js";
import { createMapReduceOrchestration } from "./patterns/map-reduce.js";
import { createDebateOrchestration } from "./patterns/debate.js";

const VALID_PATTERNS = new Set([
  "supervisor",
  "swarm",
  "pipeline",
  "map-reduce",
  "debate",
]);

let counter = 0;

export class AgentOrchestratorAdapter implements AgentOrchestratorPort {
  createOrchestration(config: OrchestrationConfig): Orchestration {
    if (!config.agents || config.agents.length === 0) {
      throw new Error("At least one agent is required for orchestration");
    }

    if (!VALID_PATTERNS.has(config.pattern)) {
      throw new Error(`Invalid orchestration pattern: ${config.pattern}`);
    }

    const id = `orch_${++counter}_${Date.now()}`;

    const timeout = config.options?.timeout;

    const orchestration = this.buildOrchestration(config, id);

    if (timeout && timeout > 0) {
      return this.wrapWithTimeout(orchestration, timeout);
    }

    return orchestration;
  }

  private buildOrchestration(
    config: OrchestrationConfig,
    id: string,
  ): Orchestration {
    switch (config.pattern) {
      case "supervisor":
        return createSupervisorOrchestration(config, id);
      case "swarm":
        return createSwarmOrchestration(config, id);
      case "pipeline":
        return createPipelineOrchestration(config, id);
      case "map-reduce":
        return createMapReduceOrchestration(config, id);
      case "debate":
        return createDebateOrchestration(config, id);
      default:
        throw new Error(`Unknown pattern: ${config.pattern}`);
    }
  }

  private wrapWithTimeout(
    orchestration: Orchestration,
    timeout: number,
  ): Orchestration {
    const originalExecute = orchestration.execute.bind(orchestration);

    orchestration.execute = async (input: string) => {
      const timer = setTimeout(() => orchestration.cancel(), timeout);
      try {
        return await originalExecute(input);
      } finally {
        clearTimeout(timer);
      }
    };

    return orchestration;
  }
}
