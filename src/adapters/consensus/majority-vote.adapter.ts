// =============================================================================
// MajorityVoteConsensus — Simple majority voting by output similarity
// =============================================================================

import type {
  ConsensusPort,
  ConsensusResult,
} from "../../ports/consensus.port.js";

export class MajorityVoteConsensus implements ConsensusPort {
  async evaluate(
    results: Array<{ id: string; output: string }>,
  ): Promise<ConsensusResult> {
    if (results.length === 0) {
      throw new Error("No results to evaluate");
    }

    const groups = new Map<string, Array<{ id: string; output: string }>>();

    for (const r of results) {
      const key = r.output.trim();
      const group = groups.get(key) ?? [];
      group.push(r);
      groups.set(key, group);
    }

    let bestGroup: Array<{ id: string; output: string }> = [];
    for (const group of groups.values()) {
      if (group.length > bestGroup.length) {
        bestGroup = group;
      }
    }

    const winner = bestGroup[0];
    const scores: Record<string, number> = {};
    for (const r of results) {
      scores[r.id] = r.output.trim() === winner.output.trim() ? 1 : 0;
    }

    return {
      winnerId: winner.id,
      winnerOutput: winner.output,
      scores,
      reasoning: `Selected by majority vote (${bestGroup.length}/${results.length} matching outputs)`,
    };
  }
}
