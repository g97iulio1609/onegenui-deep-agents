// =============================================================================
// Swarm Pattern — Peer-to-peer communication with shared blackboard
// =============================================================================

import type {
  Orchestration,
  OrchestrationConfig,
  OrchestrationEvent,
  OrchestrationMessage,
  OrchestrationResult,
} from "../../../ports/agent-orchestrator.port.js";

const DEFAULT_MAX_ROUNDS = 10;

export function createSwarmOrchestration(
  config: OrchestrationConfig,
  id: string,
): Orchestration {
  let abortController = new AbortController();

  const maxRounds = config.options?.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const blackboard = config.options?.swarm?.blackboard ?? new Map<string, unknown>();
  const convergenceCheck = config.options?.swarm?.convergenceCheck;

  async function execute(input: string): Promise<OrchestrationResult> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    blackboard.set("input", input);
    let roundMessages: OrchestrationMessage[] = [];
    let roundIndex = 0;

    for (let round = 0; round < maxRounds; round++) {
      if (abortController.signal.aborted) break;
      roundIndex = round + 1;

      const currentInput =
        roundMessages.length > 0
          ? roundMessages.map((m) => m.content).join("\n")
          : input;

      roundMessages = [];

      for (const agent of config.agents) {
        if (abortController.signal.aborted) break;

        const msg: OrchestrationMessage = {
          from: "swarm",
          to: agent.id,
          content: currentInput,
          metadata: { round: roundIndex, blackboard: Object.fromEntries(blackboard) },
        };

        try {
          const result = await agent.execute(msg);
          roundMessages.push(result);
          allMessages.push(msg, result);
          agentResults.get(agent.id)!.push(result);
          blackboard.set(`${agent.id}_round_${roundIndex}`, result.content);
        } catch {
          // Swarm tolerates individual agent failures
        }
      }

      if (convergenceCheck && convergenceCheck(roundMessages)) break;
    }

    const lastResponses = roundMessages.length > 0 ? roundMessages : [];
    const output = lastResponses.map((m) => m.content).join("\n");

    return {
      output,
      messages: allMessages,
      pattern: "swarm",
      agentResults,
      durationMs: Date.now() - start,
      rounds: roundIndex,
    };
  }

  async function* stream(input: string): AsyncIterable<OrchestrationEvent> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    blackboard.set("input", input);
    let roundMessages: OrchestrationMessage[] = [];
    let roundIndex = 0;

    for (let round = 0; round < maxRounds; round++) {
      if (abortController.signal.aborted) break;
      roundIndex = round + 1;
      yield { type: "round_start", round: roundIndex };

      const currentInput =
        roundMessages.length > 0
          ? roundMessages.map((m) => m.content).join("\n")
          : input;

      roundMessages = [];

      for (const agent of config.agents) {
        if (abortController.signal.aborted) break;
        yield { type: "agent_start", agentId: agent.id };

        const msg: OrchestrationMessage = {
          from: "swarm",
          to: agent.id,
          content: currentInput,
          metadata: { round: roundIndex, blackboard: Object.fromEntries(blackboard) },
        };

        try {
          const result = await agent.execute(msg);
          roundMessages.push(result);
          allMessages.push(msg, result);
          agentResults.get(agent.id)!.push(result);
          blackboard.set(`${agent.id}_round_${roundIndex}`, result.content);
          yield { type: "message", agentId: agent.id, message: result };
          yield { type: "agent_end", agentId: agent.id };
        } catch (err) {
          yield {
            type: "error",
            agentId: agent.id,
            error: err instanceof Error ? err : new Error(String(err)),
          };
          yield { type: "agent_end", agentId: agent.id };
        }
      }

      yield { type: "round_end", round: roundIndex };
      if (convergenceCheck && convergenceCheck(roundMessages)) break;
    }

    const output = roundMessages.map((m) => m.content).join("\n");

    yield {
      type: "complete",
      result: {
        output,
        messages: allMessages,
        pattern: "swarm",
        agentResults,
        durationMs: Date.now() - start,
        rounds: roundIndex,
      },
    };
  }

  function cancel(): void {
    abortController.abort();
  }

  return { id, pattern: "swarm", execute, stream, cancel };
}
