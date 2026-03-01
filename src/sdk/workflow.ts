/**
 * Workflow SDK wrapper — dependency-based step execution backed by Rust core.
 */
import {
  create_workflow,
  workflow_add_step,
  workflow_add_dependency,
  workflow_run,
  destroy_workflow,
} from "gauss-napi";

import type { Handle, Disposable, ToolDef } from "./types.js";
import type { Agent } from "./agent.js";

export interface WorkflowStepConfig {
  stepId: string;
  agent: Agent;
  instructions?: string;
  tools?: ToolDef[];
}

export class Workflow implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor() {
    this._handle = create_workflow();
  }

  get handle(): Handle {
    return this._handle;
  }

  addStep(config: WorkflowStepConfig): this {
    this.assertNotDisposed();
    workflow_add_step(
      this._handle,
      config.stepId,
      config.agent.name,
      config.agent.handle,
      config.instructions,
      config.tools ?? []
    );
    return this;
  }

  addDependency(stepId: string, dependsOn: string): this {
    this.assertNotDisposed();
    workflow_add_dependency(this._handle, stepId, dependsOn);
    return this;
  }

  async run(prompt: string): Promise<Record<string, unknown>> {
    this.assertNotDisposed();
    return workflow_run(this._handle, prompt) as Promise<
      Record<string, unknown>
    >;
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_workflow(this._handle);
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
      throw new Error("Workflow has been destroyed");
    }
  }
}
