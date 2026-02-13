import { describe, it, expect } from "vitest";

import { MajorityVoteConsensus } from "../majority-vote.adapter.js";

// =============================================================================
// Tests
// =============================================================================

describe("MajorityVoteConsensus", () => {
  it("picks most common result", async () => {
    const consensus = new MajorityVoteConsensus();
    const result = await consensus.evaluate([
      { id: "a", output: "yes" },
      { id: "b", output: "no" },
      { id: "c", output: "yes" },
    ]);

    expect(result.winnerOutput.trim()).toBe("yes");
    expect(result.scores?.["a"]).toBe(1);
    expect(result.scores?.["b"]).toBe(0);
    expect(result.scores?.["c"]).toBe(1);
  });

  it("first wins on all-unique", async () => {
    const consensus = new MajorityVoteConsensus();
    const result = await consensus.evaluate([
      { id: "x", output: "alpha" },
      { id: "y", output: "beta" },
      { id: "z", output: "gamma" },
    ]);

    // All groups have size 1; first encountered wins
    expect(result.winnerId).toBe("x");
    expect(result.winnerOutput).toBe("alpha");
  });

  it("handles single result", async () => {
    const consensus = new MajorityVoteConsensus();
    const result = await consensus.evaluate([
      { id: "only", output: "answer" },
    ]);

    expect(result.winnerId).toBe("only");
    expect(result.winnerOutput).toBe("answer");
    expect(result.scores?.["only"]).toBe(1);
  });
});
