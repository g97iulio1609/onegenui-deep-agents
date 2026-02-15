// =============================================================================
// ReRankingPort — Contract for search result re-ranking
// =============================================================================

export interface SourceAttribution {
  chunkId: string;
  chunkIndex: number;
  documentId?: string;
  startOffset: number;
  endOffset: number;
  relevanceScore: number;
}

export interface ScoredResult {
  id: string;
  text: string;
  score: number;
  source?: SourceAttribution;
}

export interface ReRankingOptions {
  strategy: "tfidf" | "bm25" | "mmr";
  /** Lambda for MMR diversity (0 = max diversity, 1 = max relevance). Default: 0.7 */
  lambda?: number;
}

export interface ReRankingPort {
  rerank(query: string, results: ScoredResult[], options?: ReRankingOptions): ScoredResult[];
}
