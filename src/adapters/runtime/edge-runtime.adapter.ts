import { BaseRuntimeAdapter } from "./base-runtime.adapter.js";

export class EdgeRuntimeAdapter extends BaseRuntimeAdapter {
  getEnv(_key: string): string | undefined {
    // Edge runtimes (Cloudflare Workers, Vercel Edge) bind env vars
    // via the request context, not a global. Return undefined by default;
    // users should subclass or provide env via config.
    return undefined;
  }
}
