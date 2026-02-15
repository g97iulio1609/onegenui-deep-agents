// =============================================================================
// ChunkingPort — Contract for text chunking strategies
// =============================================================================

export interface ChunkOptions {
  strategy: "fixed" | "sliding-window" | "semantic" | "recursive";
  /** Max tokens per chunk (word-count proxy). Default: 512 */
  maxTokens?: number;
  /** Overlap in tokens for sliding-window strategy. Default: 50 */
  overlap?: number;
  /** Separators for recursive strategy. Default: ['\n\n', '\n', '. ', ' '] */
  separators?: string[];
}

export interface Chunk {
  id: string;
  text: string;
  index: number;
  metadata: {
    startOffset: number;
    endOffset: number;
    tokenCount: number;
    source?: string;
  };
}

export interface ChunkingPort {
  chunk(text: string, options?: ChunkOptions): Chunk[];
}
