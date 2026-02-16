// =============================================================================
// DefaultChunkingAdapter — Implements fixed, sliding-window, semantic, recursive
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Chunk, ChunkingPort, ChunkOptions } from "../../ports/chunking.port.js";

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP = 50;
const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " "];

function wordCount(text: string): number {
  let count = 0;
  const re = /\S+/g;
  while (re.exec(text) !== null) count++;
  return count;
}

function makeChunk(text: string, index: number, startOffset: number, source?: string): Chunk {
  return {
    id: randomUUID(),
    text,
    index,
    metadata: {
      startOffset,
      endOffset: startOffset + text.length,
      tokenCount: wordCount(text),
      source,
    },
  };
}

// Track word positions for accurate chunk offsets
interface WordPosition { word: string; start: number; end: number; }

function getWordPositions(text: string): WordPosition[] {
  const positions: WordPosition[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return positions;
}

function splitByWordsMaxWithPositions(positions: WordPosition[], maxTokens: number): { text: string; start: number; end: number }[] {
  const parts: { text: string; start: number; end: number }[] = [];
  for (let i = 0; i < positions.length; i += maxTokens) {
    const slice = positions.slice(i, i + maxTokens);
    parts.push({
      text: slice.map(p => p.word).join(" "),
      start: slice[0]!.start,
      end: slice[slice.length - 1]!.end,
    });
  }
  return parts;
}

function splitByWordsMax(text: string, maxTokens: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  for (let i = 0; i < words.length; i += maxTokens) {
    parts.push(words.slice(i, i + maxTokens).join(" "));
  }
  return parts;
}

function chunkFixed(text: string, maxTokens: number): string[] {
  return splitByWordsMax(text, maxTokens);
}

function chunkSlidingWindow(text: string, maxTokens: number, overlap: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const step = Math.max(1, maxTokens - overlap);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + maxTokens).join(" "));
    if (i + maxTokens >= words.length) break;
  }
  return chunks;
}

function chunkSemantic(text: string, maxTokens: number): string[] {
  // Split on paragraph boundaries first, then sentence boundaries
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    const candidateWc = wordCount(candidate);
    if (candidateWc <= maxTokens) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      // If a single paragraph exceeds maxTokens, split by sentences
      // When current was empty, candidate === para, so reuse candidateWc
      const paraWc = current ? wordCount(para) : candidateWc;
      if (paraWc > maxTokens) {
        const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
        let sentBuf = "";
        for (const s of sentences) {
          const next = sentBuf ? `${sentBuf} ${s}` : s;
          const nextWc = wordCount(next);
          if (nextWc <= maxTokens) {
            sentBuf = next;
          } else {
            if (sentBuf) chunks.push(sentBuf);
            // If a single sentence exceeds maxTokens, force split by words
            // When sentBuf was empty, next === s, so reuse nextWc
            const sWc = sentBuf ? wordCount(s) : nextWc;
            if (sWc > maxTokens) {
              chunks.push(...splitByWordsMax(s, maxTokens));
              sentBuf = "";
            } else {
              sentBuf = s;
            }
          }
        }
        current = sentBuf;
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function chunkRecursive(text: string, maxTokens: number, separators: string[]): string[] {
  const wc = wordCount(text);
  if (wc <= maxTokens || separators.length === 0) {
    // If no separators left and still too large, force split by words
    if (wc > maxTokens) return splitByWordsMax(text, maxTokens);
    return [text];
  }

  const sep = separators[0]!;
  const rest = separators.slice(1);
  const parts = text.split(sep).filter(Boolean);

  const results: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const candidate = buffer ? `${buffer}${sep}${part}` : part;
    const candidateWc = wordCount(candidate);
    if (candidateWc <= maxTokens) {
      buffer = candidate;
    } else {
      if (buffer) results.push(buffer);
      // When buffer was empty, candidate === part, so reuse candidateWc
      const partWc = buffer ? wordCount(part) : candidateWc;
      if (partWc > maxTokens) {
        results.push(...chunkRecursive(part, maxTokens, rest));
        buffer = "";
      } else {
        buffer = part;
      }
    }
  }
  if (buffer) results.push(buffer);
  return results;
}

export class DefaultChunkingAdapter implements ChunkingPort {
  chunk(text: string, options?: ChunkOptions): Chunk[] {
    if (!text || !text.trim()) return [];

    const strategy = options?.strategy ?? "fixed";
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const overlap = options?.overlap ?? DEFAULT_OVERLAP;
    const separators = options?.separators ?? DEFAULT_SEPARATORS;

    let rawChunks: string[];

    switch (strategy) {
      case "fixed":
        rawChunks = chunkFixed(text, maxTokens);
        break;
      case "sliding-window":
        rawChunks = chunkSlidingWindow(text, maxTokens, overlap);
        break;
      case "semantic":
        rawChunks = chunkSemantic(text, maxTokens);
        break;
      case "recursive":
        rawChunks = chunkRecursive(text, maxTokens, separators);
        break;
      default:
        rawChunks = chunkFixed(text, maxTokens);
    }

    // Build chunks with accurate offsets using word positions
    const wordPositions = getWordPositions(text);
    const chunks: Chunk[] = [];
    let searchWordIdx = 0;
    for (let i = 0; i < rawChunks.length; i++) {
      const raw = rawChunks[i]!;
      const chunkWords = raw.split(/\s+/).filter(Boolean);
      if (chunkWords.length === 0) continue;

      // Find the first word of this chunk in wordPositions from searchWordIdx
      let matchIdx = searchWordIdx;
      for (let j = searchWordIdx; j < wordPositions.length; j++) {
        if (wordPositions[j]!.word === chunkWords[0]) { matchIdx = j; break; }
      }

      const startPos = matchIdx < wordPositions.length ? wordPositions[matchIdx]!.start : 0;
      const lastWordIdx = Math.min(matchIdx + chunkWords.length - 1, wordPositions.length - 1);
      const endPos = lastWordIdx >= 0 ? wordPositions[lastWordIdx]!.end : startPos + raw.length;
      chunks.push(makeChunk(raw, i, startPos));
      chunks[chunks.length - 1]!.metadata.endOffset = endPos;
      // For sliding-window, don't advance past overlap
      searchWordIdx = matchIdx + 1;
    }
    return chunks;
  }
}
