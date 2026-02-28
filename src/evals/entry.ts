// =============================================================================
// Evals — Public API (sub-entry point: gauss-ai/evals)
// =============================================================================

// Semantic search evaluation
export {
  DEFAULT_SEMANTIC_SEARCH_THRESHOLDS,
  evaluateSemanticSearchSuite,
  assertSemanticSearchQualityGate,
  DEFAULT_SEMANTIC_BENCHMARK_BUDGETS,
  summaryToBenchmarkSnapshot,
  compareSemanticSearchBenchmark,
  assertSemanticSearchBenchmarkGate,
  renderSemanticSearchBenchmarkMarkdown,
  DEFAULT_SEMANTIC_STRESS_THRESHOLDS,
  evaluateSemanticSearchStressSuite,
  assertSemanticSearchStressGate,
} from "./index.js";
export type {
  SemanticSearchEvalCase,
  SemanticSearchEvalResult,
  SemanticSearchEvalRunOutput,
  SemanticSearchCaseMetrics,
  SemanticSearchQualityThresholds,
  SemanticSearchEvaluationSummary,
  SemanticSearchEvaluationOptions,
  SemanticSearchRunner,
  SemanticSearchBenchmarkBaseline,
  SemanticSearchBenchmarkBudgets,
  SemanticSearchBenchmarkComparison,
  SemanticSearchStressSample,
  SemanticSearchStressThresholds,
  SemanticSearchStressSummary,
} from "./index.js";

// Scorer
export {
  ScorerPipeline, createScorer,
  exactMatchScorer, containsScorer, lengthScorer, llmJudgeScorer,
} from "./scorer.js";
export type { Scorer, ScoreResult, ScorerContext } from "./scorer.js";

// Trajectory
export {
  TrajectoryRecorder, hasAgentSteps, hasToolCallRequests, hasNoErrors,
  hasToolCallCount, completedWithin, hasOrderedSteps,
  exportTrajectory, importTrajectory,
} from "./trajectory.js";
export type { Trajectory, TrajectoryStep } from "./trajectory.js";
