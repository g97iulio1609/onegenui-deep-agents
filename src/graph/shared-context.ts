// =============================================================================
// SharedContext — Namespaced shared state between agents in a graph
// =============================================================================

import type { FilesystemPort } from "../ports/filesystem.port.js";

export class SharedContext {
  constructor(
    private readonly fs: FilesystemPort,
    private readonly namespace: string = "/.shared",
  ) {}

  private keyPath(key: string): string {
    return `${this.namespace}/${key}`;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.fs.write(this.keyPath(key), JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    const path = this.keyPath(key);
    if (!(await this.fs.exists(path))) return null;
    const raw = await this.fs.read(path);
    return JSON.parse(raw) as T;
  }

  async delete(key: string): Promise<void> {
    const path = this.keyPath(key);
    if (await this.fs.exists(path)) {
      await this.fs.delete(path);
    }
  }

  async list(): Promise<string[]> {
    if (!(await this.fs.exists(this.namespace))) return [];
    const entries = await this.fs.list(this.namespace);
    return entries
      .filter((e) => !e.isDirectory)
      .map((e) => e.name);
  }

  async getNodeResult(nodeId: string): Promise<string | null> {
    return this.get<string>(`results/${nodeId}`);
  }

  async setNodeResult(nodeId: string, result: string): Promise<void> {
    await this.set(`results/${nodeId}`, result);
  }
}
