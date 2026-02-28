// =============================================================================
// MapReduce Pattern — Split work across parallel agents, then reduce
// =============================================================================

import type {
  Orchestration,
  OrchestrationConfig,
  OrchestrationEvent,
  OrchestrationMessage,
  OrchestrationResult,
} from "../../../ports/agent-orchestrator.port.js";

const DEFAULT_CONCURRENCY = Infinity;

export function createMapReduceOrchestration(
  config: OrchestrationConfig,
  id: string,
): Orchestration {
  let abortController = new AbortController();

  const mapReduceOpts = config.options?.mapReduce;
  if (!mapReduceOpts) {
    throw new Error("MapReduce pattern requires mapReduce options (splitFn, reduceFn)");
  }

  const { splitFn, reduceFn } = mapReduceOpts;
  const concurrency = mapReduceOpts.concurrency ?? DEFAULT_CONCURRENCY;

  async function execute(input: string): Promise<OrchestrationResult> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    const chunks = splitFn(input);
    const mapResults: OrchestrationMessage[] = [];

    // Process chunks with concurrency control
    const pending: Promise<void>[] = [];
    let chunkIndex = 0;

    async function processChunk(chunk: string): Promise<void> {
      if (abortController.signal.aborted) return;

      const agentIndex = chunkIndex % config.agents.length;
      const agent = config.agents[agentIndex];
      chunkIndex++;

      const msg: OrchestrationMessage = {
        from: "map-reduce",
        to: agent.id,
        content: chunk,
        metadata: { phase: "map" },
      };

      try {
        const result = await agent.execute(msg);
        allMessages.push(msg, result);
        agentResults.get(agent.id)!.push(result);
        mapResults.push(result);
      } catch {
        // Skip failed chunks
      }
    }

    if (concurrency === Infinity) {
      await Promise.all(chunks.map((chunk) => processChunk(chunk)));
    } else {
      for (const chunk of chunks) {
        if (abortController.signal.aborted) break;

        if (pending.length >= concurrency) {
          await Promise.race(pending);
        }

        const p = processChunk(chunk).then(() => {
          pending.splice(pending.indexOf(p), 1);
        });
        pending.push(p);
      }
      await Promise.all(pending);
    }

    const reduced = reduceFn(mapResults);

    return {
      output: reduced.content,
      messages: allMessages,
      pattern: "map-reduce",
      agentResults,
      durationMs: Date.now() - start,
      rounds: 1,
    };
  }

  async function* stream(input: string): AsyncIterable<OrchestrationEvent> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    yield { type: "round_start", round: 1 };

    const chunks = splitFn(input);
    const mapResults: OrchestrationMessage[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (abortController.signal.aborted) break;

      const agent = config.agents[i % config.agents.length];
      yield { type: "agent_start", agentId: agent.id };

      const msg: OrchestrationMessage = {
        from: "map-reduce",
        to: agent.id,
        content: chunks[i],
        metadata: { phase: "map" },
      };

      try {
        const result = await agent.execute(msg);
        allMessages.push(msg, result);
        agentResults.get(agent.id)!.push(result);
        mapResults.push(result);
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

    const reduced = reduceFn(mapResults);

    yield { type: "round_end", round: 1 };

    yield {
      type: "complete",
      result: {
        output: reduced.content,
        messages: allMessages,
        pattern: "map-reduce",
        agentResults,
        durationMs: Date.now() - start,
        rounds: 1,
      },
    };
  }

  function cancel(): void {
    abortController.abort();
  }

  return { id, pattern: "map-reduce", execute, stream, cancel };
}
