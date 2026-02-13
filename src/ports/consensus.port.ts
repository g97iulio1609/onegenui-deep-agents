// =============================================================================
// ConsensusPort — Strategy for evaluating fork results
// =============================================================================

export interface ConsensusResult {
  winnerId: string;
  winnerOutput: string;
  scores?: Record<string, number>;
  merged?: string;
  reasoning?: string;
}

export interface ConsensusPort {
  evaluate(
    results: Array<{ id: string; output: string }>,
  ): Promise<ConsensusResult>;
}
