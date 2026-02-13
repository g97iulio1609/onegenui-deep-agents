// =============================================================================
// Runtime Detection — Lazy capability detection for multi-runtime support
// =============================================================================

export type RuntimeId = "node" | "deno" | "bun" | "cloudflare-workers" | "browser" | "unknown";

export interface RuntimeCapabilities {
  runtime: RuntimeId;
  hasNativeFs: boolean;
  hasIndexedDB: boolean;
  hasOPFS: boolean;
  hasDenoKv: boolean;
  hasFetch: boolean;
  hasWebCrypto: boolean;
}

/** Detect the current runtime environment (lazy, cached) */
export function detectRuntime(): RuntimeId {
  // Deno detection
  if (typeof (globalThis as any).Deno !== "undefined") return "deno";
  // Bun detection
  if (typeof (globalThis as any).Bun !== "undefined") return "bun";
  // Cloudflare Workers detection (has fetch, no window, no process)
  if (typeof (globalThis as any).caches !== "undefined"
      && typeof (globalThis as any).process === "undefined"
      && typeof (globalThis as any).window === "undefined") return "cloudflare-workers";
  // Node.js detection
  if (typeof (globalThis as any).process !== "undefined"
      && typeof (globalThis as any).process.versions?.node === "string") return "node";
  // Browser detection
  if (typeof (globalThis as any).window !== "undefined"
      && typeof (globalThis as any).document !== "undefined") return "browser";
  return "unknown";
}

/** Detect available capabilities (lazy, cached) */
export function detectCapabilities(): RuntimeCapabilities {
  const runtime = detectRuntime();
  return {
    runtime,
    hasNativeFs: runtime === "node" || runtime === "bun" || runtime === "deno",
    hasIndexedDB: typeof (globalThis as any).indexedDB !== "undefined",
    hasOPFS: typeof (globalThis as any).navigator?.storage?.getDirectory === "function",
    hasDenoKv: runtime === "deno" && typeof (globalThis as any).Deno?.openKv === "function",
    hasFetch: typeof globalThis.fetch === "function",
    hasWebCrypto: typeof globalThis.crypto?.randomUUID === "function",
  };
}
