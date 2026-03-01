/**
 * Stream utilities backed by Rust core.
 */
import { parse_partial_json } from "gauss-napi";

export function parsePartialJson(text: string): string | null {
  return parse_partial_json(text);
}
