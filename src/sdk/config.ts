/**
 * Config utilities backed by Rust core.
 */
import {
  agent_config_from_json,
  agent_config_resolve_env,
} from "gauss-napi";

export function parseAgentConfig(jsonStr: string): string {
  return agent_config_from_json(jsonStr);
}

export function resolveEnv(value: string): string {
  return agent_config_resolve_env(value);
}
