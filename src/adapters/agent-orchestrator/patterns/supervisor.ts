// =============================================================================
// Supervisor Pattern — One agent delegates to sub-agents, aggregates results
// =============================================================================

import type {
  Orchestration,
  OrchestrationConfig,
  OrchestrationEvent,
  OrchestrationMessage,
  OrchestrationResult,
} from "../../../ports/agent-orchestrator.port.js";

export function createSupervisorOrchestration(
  config: OrchestrationConfig,
  id: string,
): Orchestration {
  let abortController = new AbortController();

  const opts = config.options?.supervisor ?? {
    delegationStrategy: "round-robin",
    aggregationStrategy: "concat",
  };
  const maxRounds = config.options?.maxRounds ?? 1;

  async function execute(input: string): Promise<OrchestrationResult> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    let roundIndex = 0;
    for (let round = 0; round < maxRounds; round++) {
      if (abortController.signal.aborted) break;
      roundIndex = round + 1;

      const agentsForRound = selectAgents(config, opts.delegationStrategy, round);

      for (const agent of agentsForRound) {
        if (abortController.signal.aborted) break;

        const msg: OrchestrationMessage = {
          from: "supervisor",
          to: agent.id,
          content: input,
        };

        try {
          const result = await agent.execute(msg);
          allMessages.push(msg, result);
          agentResults.get(agent.id)!.push(result);
        } catch (err) {
          const errorMsg: OrchestrationMessage = {
            from: agent.id,
            to: "supervisor",
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            metadata: { error: true },
          };
          allMessages.push(msg, errorMsg);
          agentResults.get(agent.id)!.push(errorMsg);
        }
      }
    }

    const responses = Array.from(agentResults.values())
      .flat()
      .filter((m) => !m.metadata?.error);

    const output = aggregate(responses, opts.aggregationStrategy);

    return {
      output,
      messages: allMessages,
      pattern: "supervisor",
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

    let roundIndex = 0;
    for (let round = 0; round < maxRounds; round++) {
      if (abortController.signal.aborted) break;
      roundIndex = round + 1;
      yield { type: "round_start", round: roundIndex };

      const agentsForRound = selectAgents(config, opts.delegationStrategy, round);

      for (const agent of agentsForRound) {
        if (abortController.signal.aborted) break;
        yield { type: "agent_start", agentId: agent.id };

        const msg: OrchestrationMessage = {
          from: "supervisor",
          to: agent.id,
          content: input,
        };

        try {
          const result = await agent.execute(msg);
          allMessages.push(msg, result);
          agentResults.get(agent.id)!.push(result);
          yield { type: "message", agentId: agent.id, message: result };
          yield { type: "agent_end", agentId: agent.id };
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          yield { type: "error", agentId: agent.id, error };
          yield { type: "agent_end", agentId: agent.id };
        }
      }

      yield { type: "round_end", round: roundIndex };
    }

    const responses = Array.from(agentResults.values())
      .flat()
      .filter((m) => !m.metadata?.error);

    yield {
      type: "complete",
      result: {
        output: aggregate(responses, opts.aggregationStrategy),
        messages: allMessages,
        pattern: "supervisor",
        agentResults,
        durationMs: Date.now() - start,
        rounds: roundIndex,
      },
    };
  }

  function cancel(): void {
    abortController.abort();
  }

  return { id, pattern: "supervisor", execute, stream, cancel };
}

function selectAgents(
  config: OrchestrationConfig,
  strategy: string,
  round: number,
) {
  if (strategy === "round-robin") {
    const idx = round % config.agents.length;
    return round === 0 ? config.agents : [config.agents[idx]];
  }
  return config.agents;
}

function aggregate(
  messages: OrchestrationMessage[],
  strategy: string,
): string {
  if (messages.length === 0) return "";

  switch (strategy) {
    case "vote": {
      const counts = new Map<string, number>();
      for (const m of messages) {
        counts.set(m.content, (counts.get(m.content) ?? 0) + 1);
      }
      let best = "";
      let bestCount = 0;
      for (const [content, count] of counts) {
        if (count > bestCount) {
          best = content;
          bestCount = count;
        }
      }
      return best;
    }
    case "summarize":
      return messages.map((m) => `[${m.from}]: ${m.content}`).join("\n");
    case "concat":
    default:
      return messages.map((m) => m.content).join("\n");
  }
}
