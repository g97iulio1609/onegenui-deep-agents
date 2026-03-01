/**
 * Token counting utilities backed by Rust core (tiktoken).
 */
import {
  count_tokens,
  count_tokens_for_model,
  count_message_tokens,
  get_context_window_size,
} from "gauss-napi";

import type { JsMessage } from "./types.js";

export function countTokens(text: string): number {
  return count_tokens(text);
}

export function countTokensForModel(text: string, model: string): number {
  return count_tokens_for_model(text, model);
}

export function countMessageTokens(messages: JsMessage[]): number {
  return count_message_tokens(messages);
}

export function getContextWindowSize(model: string): number {
  return get_context_window_size(model);
}
