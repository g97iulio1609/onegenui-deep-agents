// =============================================================================
// Pipeline Pattern — Chain agents in sequence, each transforming the output
// =============================================================================

import type {
  Orchestration,
  OrchestrationConfig,
  OrchestrationEvent,
  OrchestrationMessage,
  OrchestrationResult,
} from "../../../ports/agent-orchestrator.port.js";

const DEFAULT_RETRY_COUNT = 2;

export function createPipelineOrchestration(
  config: OrchestrationConfig,
  id: string,
): Orchestration {
  let abortController = new AbortController();

  const errorStrategy = config.options?.pipeline?.errorStrategy ?? "stop";
  const retryCount = config.options?.pipeline?.retryCount ?? DEFAULT_RETRY_COUNT;

  async function execute(input: string): Promise<OrchestrationResult> {
    const start = Date.now();
    const allMessages: OrchestrationMessage[] = [];
    const agentResults = new Map<string, OrchestrationMessage[]>();

    for (const agent of config.agents) {
      agentResults.set(agent.id, []);
    }

    let currentContent = input;

    for (const agent of config.agents) {
      if (abortController.signal.aborted) break;

      const msg: OrchestrationMessage = {
        from: "pipeline",
        to: agent.id,
        content: currentContent,
      };

      try {
        const result = await executeWithRetry(agent, msg, errorStrategy, retryCount);
        allMessages.push(msg, result);
        agentResults.get(agent.id)!.push(result);
        currentContent = result.content;
      } catch (err) {
        const errorMsg: OrchestrationMessage = {
          from: agent.id,
          to: "pipeline",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          metadata: { error: true },
        };
        allMessages.push(msg, errorMsg);
        agentResults.get(agent.id)!.push(errorMsg);

        if (errorStrategy === "stop") break;
        // skip: continue with the current content unchanged
      }
    }

    return {
      output: currentContent,
      messages: allMessages,
      pattern: "pipeline",
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

    let currentContent = input;
    yield { type: "round_start", round: 1 };

    for (const agent of config.agents) {
      if (abortController.signal.aborted) break;
      yield { type: "agent_start", agentId: agent.id };

      const msg: OrchestrationMessage = {
        from: "pipeline",
        to: agent.id,
        content: currentContent,
      };

      try {
        const result = await executeWithRetry(agent, msg, errorStrategy, retryCount);
        allMessages.push(msg, result);
        agentResults.get(agent.id)!.push(result);
        currentContent = result.content;
        yield { type: "message", agentId: agent.id, message: result };
        yield { type: "agent_end", agentId: agent.id };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        yield { type: "error", agentId: agent.id, error };
        yield { type: "agent_end", agentId: agent.id };
        if (errorStrategy === "stop") break;
      }
    }

    yield { type: "round_end", round: 1 };

    yield {
      type: "complete",
      result: {
        output: currentContent,
        messages: allMessages,
        pattern: "pipeline",
        agentResults,
        durationMs: Date.now() - start,
        rounds: 1,
      },
    };
  }

  function cancel(): void {
    abortController.abort();
  }

  return { id, pattern: "pipeline", execute, stream, cancel };
}

async function executeWithRetry(
  agent: { id: string; execute: (input: OrchestrationMessage) => Promise<OrchestrationMessage> },
  msg: OrchestrationMessage,
  errorStrategy: string,
  retryCount: number,
): Promise<OrchestrationMessage> {
  let lastError: unknown;

  const attempts = errorStrategy === "retry" ? retryCount + 1 : 1;
  for (let i = 0; i < attempts; i++) {
    try {
      return await agent.execute(msg);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
