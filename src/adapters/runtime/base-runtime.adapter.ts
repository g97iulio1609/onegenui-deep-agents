import type { RuntimePort } from "../../ports/runtime.port.js";

/**
 * Base implementation of RuntimePort using Web Standard APIs.
 * Subclasses only need to override getEnv() for runtime-specific env access.
 */
export abstract class BaseRuntimeAdapter implements RuntimePort {
  randomUUID(): string {
    return crypto.randomUUID();
  }

  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(input, init);
  }

  abstract getEnv(key: string): string | undefined;

  setTimeout(callback: () => void, ms: number): { clear(): void } {
    const handle = globalThis.setTimeout(callback, ms);
    return { clear: () => globalThis.clearTimeout(handle) };
  }
}
