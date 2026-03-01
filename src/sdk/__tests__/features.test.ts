/**
 * Unit tests for Guardrail, Telemetry, Plugin, Middleware, Eval, HITL, Resilience, Tokens, Config.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("gauss-napi", () => ({
  // Middleware
  create_middleware_chain: vi.fn(() => 1),
  middleware_use_logging: vi.fn(),
  middleware_use_caching: vi.fn(),
  destroy_middleware_chain: vi.fn(),

  // Plugin
  create_plugin_registry: vi.fn(() => 2),
  plugin_registry_add_telemetry: vi.fn(),
  plugin_registry_add_memory: vi.fn(),
  plugin_registry_list: vi.fn(() => ["telemetry", "memory"]),
  plugin_registry_emit: vi.fn(),
  destroy_plugin_registry: vi.fn(),

  // Guardrail
  create_guardrail_chain: vi.fn(() => 3),
  guardrail_chain_add_content_moderation: vi.fn(),
  guardrail_chain_add_pii_detection: vi.fn(),
  guardrail_chain_add_token_limit: vi.fn(),
  guardrail_chain_add_regex_filter: vi.fn(),
  guardrail_chain_add_schema: vi.fn(),
  guardrail_chain_list: vi.fn(() => ["content_moderation", "pii_detection"]),
  destroy_guardrail_chain: vi.fn(),

  // Eval
  create_eval_runner: vi.fn(() => 4),
  eval_add_scorer: vi.fn(),
  load_dataset_jsonl: vi.fn(() => [{ input: "q", expected: "a" }]),
  load_dataset_json: vi.fn(() => [{ input: "q" }]),
  destroy_eval_runner: vi.fn(),

  // Telemetry
  create_telemetry: vi.fn(() => 5),
  telemetry_record_span: vi.fn(),
  telemetry_export_spans: vi.fn(() => [{ name: "agent.run", duration: 100 }]),
  telemetry_export_metrics: vi.fn(() => ({ totalSpans: 1 })),
  telemetry_clear: vi.fn(),
  destroy_telemetry: vi.fn(),

  // HITL
  create_approval_manager: vi.fn(() => 6),
  approval_request: vi.fn(() => "req-123"),
  approval_approve: vi.fn(),
  approval_deny: vi.fn(),
  approval_list_pending: vi.fn(() => []),
  destroy_approval_manager: vi.fn(),

  create_checkpoint_store: vi.fn(() => 7),
  checkpoint_save: vi.fn(async () => undefined),
  checkpoint_load: vi.fn(async () => ({ id: "cp1", data: {} })),
  checkpoint_load_latest: vi.fn(async () => ({ id: "cp2" })),
  destroy_checkpoint_store: vi.fn(),

  // Resilience
  create_fallback_provider: vi.fn(() => 50),
  create_circuit_breaker: vi.fn(() => 51),
  create_resilient_provider: vi.fn(() => 52),

  // Tokens
  count_tokens: vi.fn(() => 42),
  count_tokens_for_model: vi.fn(() => 45),
  count_message_tokens: vi.fn(() => 100),
  get_context_window_size: vi.fn(() => 128000),

  // Config
  agent_config_from_json: vi.fn(() => '{"name":"test"}'),
  agent_config_resolve_env: vi.fn(() => "resolved-value"),

  // Tool Validator
  create_tool_validator: vi.fn(() => 8),
  tool_validator_validate: vi.fn(() => '{"valid":true}'),
  destroy_tool_validator: vi.fn(),

  // MCP
  create_mcp_server: vi.fn(() => 9),
  mcp_server_add_tool: vi.fn(),
  mcp_server_handle: vi.fn(async () => ({ jsonrpc: "2.0", result: {} })),
  destroy_mcp_server: vi.fn(),

  // Stream
  parse_partial_json: vi.fn(() => '{"partial":true}'),
}));

import { MiddlewareChain } from "../middleware.js";
import { PluginRegistry } from "../plugin.js";
import { GuardrailChain } from "../guardrail.js";
import { EvalRunner } from "../eval.js";
import { Telemetry } from "../telemetry.js";
import { ApprovalManager } from "../approval.js";
import { CheckpointStore } from "../checkpoint.js";
import { createFallbackProvider, createCircuitBreaker, createResilientProvider } from "../resilience.js";
import { countTokens, countTokensForModel, countMessageTokens, getContextWindowSize } from "../tokens.js";
import { parseAgentConfig, resolveEnv } from "../config.js";
import { ToolValidator } from "../tool-validator.js";
import { McpServer } from "../mcp.js";
import { parsePartialJson } from "../stream.js";

beforeEach(() => vi.clearAllMocks());

describe("MiddlewareChain", () => {
  it("chains logging and caching", () => {
    const chain = new MiddlewareChain().useLogging().useCaching(5000);
    expect(chain.handle).toBe(1);
    chain.destroy();
  });
});

describe("PluginRegistry", () => {
  it("registers plugins and emits events", () => {
    const reg = new PluginRegistry().addTelemetry().addMemory();
    expect(reg.list()).toEqual(["telemetry", "memory"]);
    reg.emit({ type: "agent.start", agentName: "test" });
    reg.destroy();
  });
});

describe("GuardrailChain", () => {
  it("adds all guardrail types fluently", () => {
    const chain = new GuardrailChain()
      .addContentModeration(["bad"], ["warn"])
      .addPiiDetection("redact")
      .addTokenLimit(1000, 500)
      .addRegexFilter(["block-regex"])
      .addSchema({ type: "object" });
    expect(chain.list()).toEqual(["content_moderation", "pii_detection"]);
    chain.destroy();
  });
});

describe("EvalRunner", () => {
  it("creates runner with scorer", () => {
    const runner = new EvalRunner(0.8).addScorer("exact_match");
    expect(runner.handle).toBe(4);
    runner.destroy();
  });

  it("loads datasets", () => {
    expect(EvalRunner.loadDatasetJsonl('{"input":"q"}')).toEqual([{ input: "q", expected: "a" }]);
    expect(EvalRunner.loadDatasetJson('[{"input":"q"}]')).toEqual([{ input: "q" }]);
  });
});

describe("Telemetry", () => {
  it("records and exports spans", () => {
    const tel = new Telemetry();
    tel.recordSpan({ name: "test", duration: 50 });
    const spans = tel.exportSpans();
    expect(spans).toEqual([{ name: "agent.run", duration: 100 }]);
    tel.clear();
    tel.destroy();
  });
});

describe("ApprovalManager", () => {
  it("manages approval flow", () => {
    const mgr = new ApprovalManager();
    const reqId = mgr.request("dangerous_tool", { action: "delete" }, "session-1");
    expect(reqId).toBe("req-123");
    mgr.approve(reqId);
    mgr.deny("other-req", "Not safe");
    expect(mgr.listPending()).toEqual([]);
    mgr.destroy();
  });
});

describe("CheckpointStore", () => {
  it("saves and loads checkpoints", async () => {
    const store = new CheckpointStore();
    await store.save({ id: "cp1", data: { step: 3 } });
    const cp = await store.load("cp1");
    expect(cp).toEqual({ id: "cp1", data: {} });
    const latest = await store.loadLatest("session-1");
    expect(latest).toEqual({ id: "cp2" });
    store.destroy();
  });
});

describe("Resilience", () => {
  it("creates fallback provider", () => {
    expect(createFallbackProvider([1, 2, 3])).toBe(50);
  });

  it("creates circuit breaker", () => {
    expect(createCircuitBreaker(1, 5, 30000)).toBe(51);
  });

  it("creates resilient provider", () => {
    expect(createResilientProvider(1, [2, 3], true)).toBe(52);
  });
});

describe("Tokens", () => {
  it("counts tokens", () => {
    expect(countTokens("hello world")).toBe(42);
    expect(countTokensForModel("hello", "gpt-4")).toBe(45);
    expect(countMessageTokens([{ role: "user", content: "hi" }])).toBe(100);
    expect(getContextWindowSize("gpt-4")).toBe(128000);
  });
});

describe("Config", () => {
  it("parses agent config", () => {
    expect(parseAgentConfig('{"name":"test"}')).toBe('{"name":"test"}');
  });

  it("resolves env variables", () => {
    expect(resolveEnv("${SOME_VAR}")).toBe("resolved-value");
  });
});

describe("ToolValidator", () => {
  it("validates tool input against schema", () => {
    const v = new ToolValidator(["type_cast", "null_to_default"]);
    const result = v.validate({ name: "test" }, { type: "object" });
    expect(result).toEqual({ valid: true });
    v.destroy();
  });
});

describe("McpServer", () => {
  it("creates server, adds tools, handles messages", async () => {
    const srv = new McpServer("test-server", "1.0.0");
    srv.addTool({ name: "greet", description: "Say hello" });
    const response = await srv.handleMessage({ jsonrpc: "2.0", method: "tools/list" });
    expect(response).toEqual({ jsonrpc: "2.0", result: {} });
    srv.destroy();
  });
});

describe("parsePartialJson", () => {
  it("parses partial JSON from streaming", () => {
    expect(parsePartialJson('{"partial": tru')).toBe('{"partial":true}');
  });
});
