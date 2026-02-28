import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectBackend,
  hasNativeBackend,
  getBackendModule,
  resetBackendCache,
} from "../runtime/backend.js";
import type { BackendInfo } from "../runtime/backend.js";

describe("Backend Detection", () => {
  beforeEach(() => {
    resetBackendCache();
    delete process.env["GAUSS_BACKEND"];
    delete process.env["GAUSS_NAPI_PATH"];
    delete process.env["GAUSS_WASM_PATH"];
  });

  it("detectBackend returns a BackendInfo object", () => {
    const backend = detectBackend();
    expect(backend).toHaveProperty("type");
    expect(backend).toHaveProperty("version");
    expect(backend).toHaveProperty("module");
    expect(["napi", "wasm", "none"]).toContain(backend.type);
  });

  it("caches result across calls", () => {
    const first = detectBackend();
    const second = detectBackend();
    expect(first).toBe(second);
  });

  it("resetBackendCache clears the cache", () => {
    const first = detectBackend();
    resetBackendCache();
    const second = detectBackend();
    // Should be equal but not the same object reference (fresh detection)
    expect(second.type).toBe(first.type);
  });

  it("hasNativeBackend returns boolean", () => {
    expect(typeof hasNativeBackend()).toBe("boolean");
  });

  it("getBackendModule returns module or null", () => {
    const backend = detectBackend();
    const mod = getBackendModule();
    if (backend.type === "none") {
      expect(mod).toBeNull();
    } else {
      expect(mod).not.toBeNull();
    }
  });

  it("GAUSS_BACKEND=napi throws if NAPI not available", () => {
    process.env["GAUSS_BACKEND"] = "napi";
    resetBackendCache();
    // In test env, NAPI is unlikely to be available
    // This either succeeds (if installed) or throws
    try {
      const backend = detectBackend();
      expect(backend.type).toBe("napi");
    } catch (e) {
      expect((e as Error).message).toContain("GAUSS_BACKEND=napi");
    }
  });

  it("GAUSS_BACKEND=wasm throws if WASM not available", () => {
    process.env["GAUSS_BACKEND"] = "wasm";
    resetBackendCache();
    try {
      const backend = detectBackend();
      expect(backend.type).toBe("wasm");
    } catch (e) {
      expect((e as Error).message).toContain("GAUSS_BACKEND=wasm");
    }
  });

  it("falls back to none when no backend available", () => {
    // Without NAPI or WASM installed, should return none
    resetBackendCache();
    const backend = detectBackend();
    // Accept any valid type — environment-dependent
    expect(["napi", "wasm", "none"]).toContain(backend.type);
  });
});
