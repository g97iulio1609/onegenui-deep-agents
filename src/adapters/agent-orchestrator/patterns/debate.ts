// =============================================================================
// Debate Pattern — Multiple agents argue positions, judge picks winner
// =============================================================================

import type {
  Orchestration,
  OrchestrationConfig,
  OrchestrationEvent,
  OrchestrationMessage,
  OrchestrationResult,
} from "../../../ports/agent-orchestrator.port.js";

const DEFAULT_DEBATE_ROUNDS = 3;

export function createDebateOrchestration(
  config: OrchestrationConfig,
  id: string,
): Orchestration {
  let abortController = new AbortController();

  const debateOpts = config.options?.debate;
  const rounds = debateOpts?.rounds ?? DEFAULT_DEBATE_ROUNDS;
  const judgeAgentId = debateOpts?.judgeAgentId;
  const votingStrategy = debateOpts?.votingStrategy ?? "judge";

  const judge = judgeAgentId
    ? config.agents.find((a) => a.id === judgeAgentId)
    : undefined;

  const debaters = config.agents.filter((a) => a.id !== judgeAgentId);

  async function execute(input: string): Promise<OrchestrationResult> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    let context = input;

    for (let round = 0; round < rounds; round++) {
      if (abortController.signal.aborted) break;

      const roundResponses: OrchestrationMessage[] = [];

      for (const debater of debaters) {
        if (abortController.signal.aborted) break;

        const msg: OrchestrationMessage = {
          from: "debate",
          to: debater.id,
          content: context,
          metadata: { round: round + 1 },
        };

        try {
          const result = await debater.execute(msg);
          roundResponses.push(result);
          allMessages.push(msg, result);
          agentResults.get(debater.id)!.push(result);
        } catch {
          // Skip failed debaters
        }
      }

      context =
        roundResponses.length > 0
          ? roundResponses.map((m) => `[${m.from}]: ${m.content}`).join("\n")
          : context;
    }

    // Judge phase
    const output = await judgeResults(
      context,
      allMessages,
      agentResults,
      votingStrategy,
      judge,
      debaters,
    );

    return {
      output,
      messages: allMessages,
      pattern: "debate",
      agentResults,
      durationMs: Date.now() - start,
      rounds,
    };
  }

  async function* stream(input: string): AsyncIterable<OrchestrationEvent> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    let context = input;

    for (let round = 0; round < rounds; round++) {
      if (abortController.signal.aborted) break;
      yield { type: "round_start", round: round + 1 };

      const roundResponses: OrchestrationMessage[] = [];

      for (const debater of debaters) {
        if (abortController.signal.aborted) break;
        yield { type: "agent_start", agentId: debater.id };

        const msg: OrchestrationMessage = {
          from: "debate",
          to: debater.id,
          content: context,
          metadata: { round: round + 1 },
        };

        try {
          const result = await debater.execute(msg);
          roundResponses.push(result);
          allMessages.push(msg, result);
          agentResults.get(debater.id)!.push(result);
          yield { type: "message", agentId: debater.id, message: result };
          yield { type: "agent_end", agentId: debater.id };
        } catch (err) {
          yield {
            type: "error",
            agentId: debater.id,
            error: err instanceof Error ? err : new Error(String(err)),
          };
          yield { type: "agent_end", agentId: debater.id };
        }
      }

      context =
        roundResponses.length > 0
          ? roundResponses.map((m) => `[${m.from}]: ${m.content}`).join("\n")
          : context;

      yield { type: "round_end", round: round + 1 };
    }

    // Judge phase
    if (judge) {
      yield { type: "agent_start", agentId: judge.id };
    }

    const output = await judgeResults(
      context,
      allMessages,
      agentResults,
      votingStrategy,
      judge,
      debaters,
    );

    if (judge) {
      yield { type: "agent_end", agentId: judge.id };
    }

    yield {
      type: "complete",
      result: {
        output,
        messages: allMessages,
        pattern: "debate",
        agentResults,
        durationMs: Date.now() - start,
        rounds,
      },
    };
  }

  function cancel(): void {
    abortController.abort();
  }

  return { id, pattern: "debate", execute, stream, cancel };
}

async function judgeResults(
  context: string,
  allMessages: OrchestrationMessage[],
  agentResults: Map<string, OrchestrationMessage[]>,
  votingStrategy: string,
  judge: { id: string; execute: (input: OrchestrationMessage) => Promise<OrchestrationMessage> } | undefined,
  debaters: Array<{ id: string }>,
): Promise<string> {
  if (votingStrategy === "judge" && judge) {
    const judgeMsg: OrchestrationMessage = {
      from: "debate",
      to: judge.id,
      content: context,
      metadata: { phase: "judge" },
    };

    try {
      const verdict = await judge.execute(judgeMsg);
      allMessages.push(judgeMsg, verdict);
      agentResults.get(judge.id)!.push(verdict);
      return verdict.content;
    } catch {
      return context;
    }
  }

  // majority or unanimous: pick the most common last response
  const lastResponses: string[] = [];
  for (const debater of debaters) {
    const msgs = agentResults.get(debater.id) ?? [];
    if (msgs.length > 0) {
      lastResponses.push(msgs[msgs.length - 1].content);
    }
  }

  if (lastResponses.length === 0) return context;

  const counts = new Map<string, number>();
  for (const r of lastResponses) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  if (votingStrategy === "unanimous") {
    if (counts.size === 1) return lastResponses[0];
    return context; // No unanimity
  }

  // majority
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
