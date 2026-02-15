import { BaseRuntimeAdapter } from "./base-runtime.adapter.js";

export class DenoRuntimeAdapter extends BaseRuntimeAdapter {
  getEnv(key: string): string | undefined {
    return (globalThis as any).Deno?.env?.get(key);
  }
}
