/**
 * Eval SDK wrapper — evaluation runner backed by Rust core.
 */
import {
  create_eval_runner,
  eval_add_scorer,
  load_dataset_jsonl,
  load_dataset_json,
  destroy_eval_runner,
} from "gauss-napi";

import type { Handle, Disposable, EvalScorerType } from "./types.js";

export class EvalRunner implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;

  constructor(threshold?: number) {
    this._handle = create_eval_runner(threshold);
  }

  get handle(): Handle {
    return this._handle;
  }

  addScorer(scorerType: EvalScorerType): this {
    this.assertNotDisposed();
    eval_add_scorer(this._handle, scorerType);
    return this;
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      try {
        destroy_eval_runner(this._handle);
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
      throw new Error("EvalRunner has been destroyed");
    }
  }

  static loadDatasetJsonl(jsonl: string): unknown {
    return load_dataset_jsonl(jsonl);
  }

  static loadDatasetJson(jsonStr: string): unknown {
    return load_dataset_json(jsonStr);
  }
}
