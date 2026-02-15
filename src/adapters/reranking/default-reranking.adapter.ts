// =============================================================================
// DefaultReRankingAdapter — Implements TF-IDF, BM25, MMR re-ranking
// =============================================================================

import type { ReRankingPort, ReRankingOptions, ScoredResult } from "../../ports/reranking.port.js";

// BM25 parameters
const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
}

function termFrequency(term: string, tokens: string[]): number {
  return tokens.filter((t) => t === term).length;
}

function computeTfIdf(query: string, results: ScoredResult[]): ScoredResult[] {
  const queryTokens = tokenize(query);
  const docTokenSets = results.map((r) => tokenize(r.text));
  const n = results.length;

  // Compute IDF for each query term
  const idf = new Map<string, number>();
  for (const term of queryTokens) {
    const df = docTokenSets.filter((tokens) => tokens.includes(term)).length;
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
  }

  return results.map((r, i) => {
    const tokens = docTokenSets[i]!;
    let score = 0;
    for (const term of queryTokens) {
      const tf = termFrequency(term, tokens) / (tokens.length || 1);
      score += tf * (idf.get(term) ?? 0);
    }
    return { ...r, score };
  }).sort((a, b) => b.score - a.score);
}

function computeBm25(query: string, results: ScoredResult[]): ScoredResult[] {
  const queryTokens = tokenize(query);
  const docTokenSets = results.map((r) => tokenize(r.text));
  const n = results.length;
  const avgDl = docTokenSets.reduce((sum, t) => sum + t.length, 0) / (n || 1) || 1;

  // IDF
  const idf = new Map<string, number>();
  for (const term of queryTokens) {
    const df = docTokenSets.filter((tokens) => tokens.includes(term)).length;
    idf.set(term, Math.log((n - df + 0.5) / (df + 0.5) + 1));
  }

  return results.map((r, i) => {
    const tokens = docTokenSets[i]!;
    const dl = tokens.length;
    let score = 0;
    for (const term of queryTokens) {
      const tf = termFrequency(term, tokens);
      const idfVal = idf.get(term) ?? 0;
      score += idfVal * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (dl / avgDl))));
    }
    return { ...r, score };
  }).sort((a, b) => b.score - a.score);
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  for (const k of allKeys) {
    const va = a.get(k) ?? 0;
    const vb = b.get(k) ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function toTfVector(tokens: string[]): Map<string, number> {
  const vec = new Map<string, number>();
  for (const t of tokens) {
    vec.set(t, (vec.get(t) ?? 0) + 1);
  }
  // Normalize
  for (const [k, v] of vec) {
    vec.set(k, v / tokens.length);
  }
  return vec;
}

function computeMmr(query: string, results: ScoredResult[], lambda: number): ScoredResult[] {
  if (results.length === 0) return [];

  const queryVec = toTfVector(tokenize(query));
  const docVecs = results.map((r) => toTfVector(tokenize(r.text)));

  // Compute relevance scores (cosine similarity to query)
  const relevances = docVecs.map((dv) => cosineSimilarity(queryVec, dv));

  const selected: number[] = [];
  const remaining = new Set(results.map((_, i) => i));
  const reranked: ScoredResult[] = [];

  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const idx of remaining) {
      const rel = relevances[idx]!;
      let maxSim = 0;
      for (const selIdx of selected) {
        const sim = cosineSimilarity(docVecs[idx]!, docVecs[selIdx]!);
        if (sim > maxSim) maxSim = sim;
      }
      const mmrScore = lambda * rel - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = idx;
      }
    }

    if (bestIdx >= 0) {
      selected.push(bestIdx);
      remaining.delete(bestIdx);
      reranked.push({ ...results[bestIdx]!, score: bestScore });
    }
  }

  return reranked;
}

export class DefaultReRankingAdapter implements ReRankingPort {
  rerank(query: string, results: ScoredResult[], options?: ReRankingOptions): ScoredResult[] {
    if (results.length === 0) return [];

    const strategy = options?.strategy ?? "bm25";

    switch (strategy) {
      case "tfidf":
        return computeTfIdf(query, results);
      case "bm25":
        return computeBm25(query, results);
      case "mmr":
        return computeMmr(query, results, options?.lambda ?? 0.7);
      default:
        return computeBm25(query, results);
    }
  }
}
