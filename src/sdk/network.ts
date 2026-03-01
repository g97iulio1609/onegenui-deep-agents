/**
 * Network SDK wrapper — multi-agent delegation backed by Rust core.
 */
import {
  create_network,
  network_add_agent,
  network_set_supervisor,
  network_delegate,
  network_agent_cards,
  destroy_network,
} from "gauss-napi";

import type { Handle, Disposable } from "./types.js";
import type { Agent } from "./agent.js";

export class Network implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_network();
  }

  get handle(): Handle {
    return this._handle;
  }

  addAgent(agent: Agent, instructions?: string): this {
    this.assertNotDisposed();
    network_add_agent(
      this._handle,
      agent.name,
      agent.handle,
      instructions
    );
    return this;
  }

  setSupervisor(agentName: string): this {
    this.assertNotDisposed();
    network_set_supervisor(this._handle, agentName);
    return this;
  }

  async delegate(
    fromAgent: string,
    toAgent: string,
    prompt: string
  ): Promise<unknown> {
    this.assertNotDisposed();
    return network_delegate(this._handle, fromAgent, toAgent, prompt);
  }

  agentCards(): unknown {
    this.assertNotDisposed();
    return network_agent_cards(this._handle);
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_network(this._handle);
      } catch {
        // Already destroyed.
      }
    }
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Network has been destroyed");
    }
  }
}
