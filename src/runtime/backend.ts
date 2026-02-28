// =============================================================================
// Backend Detection — NAPI vs WASM auto-detection with env override
// =============================================================================

export type BackendType = "napi" | "wasm" | "none";

export interface BackendInfo {
  type: BackendType;
  version: string | null;
  module: unknown;
}

let cachedBackend: BackendInfo | undefined;

const NAPI_PACKAGES = [
  "@gauss-ai/core",
  "@giulio-leone/gauss-core-napi",
] as const;

const WASM_PACKAGES = [
  "@gauss-ai/wasm",
  "@giulio-leone/gauss-core-wasm",
] as const;

function tryRequire(id: string): unknown | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(id);
  } catch {
    return null;
  }
}

function tryLoadNapi(): BackendInfo | null {
  const envPath = typeof process !== "undefined"
    ? process.env["GAUSS_NAPI_PATH"]
    : undefined;

  const paths = [...NAPI_PACKAGES, envPath].filter(Boolean) as string[];

  for (const p of paths) {
    const mod = tryRequire(p);
    if (mod && typeof (mod as Record<string, unknown>).version === "function") {
      return {
        type: "napi",
        version: (mod as { version(): string }).version(),
        module: mod,
      };
    }
  }
  return null;
}

function tryLoadWasm(): BackendInfo | null {
  const envPath = typeof process !== "undefined"
    ? process.env["GAUSS_WASM_PATH"]
    : undefined;

  const paths = [...WASM_PACKAGES, envPath].filter(Boolean) as string[];

  for (const p of paths) {
    const mod = tryRequire(p);
    if (mod) {
      const version =
        typeof (mod as Record<string, unknown>).version === "function"
          ? (mod as { version(): string }).version()
          : null;
      return { type: "wasm", version, module: mod };
    }
  }
  return null;
}

/**
 * Detect available backend. Priority:
 * 1. GAUSS_BACKEND env var (explicit override: "napi" | "wasm")
 * 2. NAPI (native, fastest)
 * 3. WASM (universal fallback)
 * 4. none (pure TS path)
 */
export function detectBackend(): BackendInfo {
  if (cachedBackend) return cachedBackend;

  const override =
    typeof process !== "undefined" ? process.env["GAUSS_BACKEND"] : undefined;

  if (override === "napi") {
    const napi = tryLoadNapi();
    if (napi) {
      cachedBackend = napi;
      return napi;
    }
    throw new Error(
      "GAUSS_BACKEND=napi but NAPI module not found. " +
        "Install @gauss-ai/core or set GAUSS_NAPI_PATH."
    );
  }

  if (override === "wasm") {
    const wasm = tryLoadWasm();
    if (wasm) {
      cachedBackend = wasm;
      return wasm;
    }
    throw new Error(
      "GAUSS_BACKEND=wasm but WASM module not found. " +
        "Install @gauss-ai/wasm or set GAUSS_WASM_PATH."
    );
  }

  // Auto-detect: NAPI → WASM → none
  const napi = tryLoadNapi();
  if (napi) {
    cachedBackend = napi;
    return napi;
  }

  const wasm = tryLoadWasm();
  if (wasm) {
    cachedBackend = wasm;
    return wasm;
  }

  cachedBackend = { type: "none", version: null, module: null };
  return cachedBackend;
}

/** Check if a native backend (NAPI or WASM) is available */
export function hasNativeBackend(): boolean {
  return detectBackend().type !== "none";
}

/** Get the loaded backend module (typed) or null */
export function getBackendModule<T = unknown>(): T | null {
  const backend = detectBackend();
  return backend.module as T | null;
}

/** Reset cached backend (for testing) */
export function resetBackendCache(): void {
  cachedBackend = undefined;
}
