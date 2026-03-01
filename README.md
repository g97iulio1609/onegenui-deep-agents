# Gauss

[![npm version](https://img.shields.io/npm/v/gauss)](https://www.npmjs.com/package/gauss)
[![CI](https://github.com/giulio-leone/gauss/actions/workflows/ci.yml/badge.svg)](https://github.com/giulio-leone/gauss/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Rust-powered AI agent framework for TypeScript.**
> Zero overhead · Plug & play · Native performance via NAPI bindings.

## Install

```bash
npm install gauss
```

## Quick Start — One Line

```ts
import { gauss } from 'gauss'

const answer = await gauss('Explain quantum computing in 3 sentences')
```

That's it. Auto-detects your API key from environment variables.

## Agent with Tools

```ts
import { Agent } from 'gauss'

const agent = new Agent({
  name: 'assistant',
  provider: 'openai',
  model: 'gpt-4o',
  instructions: 'You are a helpful coding assistant.',
})

agent.addTool({
  name: 'search',
  description: 'Search the web',
  parameters: { type: 'object', properties: { query: { type: 'string' } } },
})

const result = await agent.run('Find the latest TypeScript release')
console.log(result.text)
```

## Multi-Agent Graph

```ts
import { Agent, Graph } from 'gauss'

const researcher = new Agent({ name: 'researcher', instructions: 'Research thoroughly' })
const writer = new Agent({ name: 'writer', instructions: 'Write clearly' })

const pipeline = new Graph()
  .addNode('research', researcher)
  .addNode('write', writer)
  .addEdge('research', 'write')

const result = await pipeline.run('Explain quantum computing')
```

## Workflow

```ts
import { Agent, Workflow } from 'gauss'

const planner = new Agent({ name: 'planner' })
const executor = new Agent({ name: 'executor' })

const wf = new Workflow()
  .addStep('plan', planner)
  .addStep('execute', executor)
  .addDependency('execute', 'plan')

const result = await wf.run('Build a REST API')
```

## Multi-Agent Network

```ts
import { Agent, Network } from 'gauss'

const analyst = new Agent({ name: 'analyst' })
const coder = new Agent({ name: 'coder' })

const net = new Network()
  .addAgent(analyst)
  .addAgent(coder)
  .setSupervisor('analyst')

const result = await net.delegate('coder', 'Implement a sorting algorithm')
```

## All Features

| Feature | Module | Description |
|---------|--------|-------------|
| **Agent** | `Agent` | LLM agent with tools, structured output, streaming |
| **Graph** | `Graph` | DAG-based multi-agent pipeline |
| **Workflow** | `Workflow` | Step-based execution with dependencies |
| **Network** | `Network` | Multi-agent delegation with supervisor |
| **Memory** | `Memory` | Persistent conversation memory |
| **VectorStore** | `VectorStore` | Embedding storage and semantic search |
| **Middleware** | `MiddlewareChain` | Request/response processing pipeline |
| **Guardrails** | `GuardrailChain` | Content moderation, PII, token limits, regex |
| **Evaluation** | `EvalRunner` | Agent quality scoring with datasets |
| **Telemetry** | `Telemetry` | Spans, metrics, and export |
| **Approval** | `ApprovalManager` | Human-in-the-loop approval flow |
| **Checkpoint** | `CheckpointStore` | Save/restore agent state |
| **MCP** | `McpServer` | Model Context Protocol server |
| **Resilience** | `createFallbackProvider` | Fallback, circuit breaker, retry |
| **Tokens** | `countTokens` | Token counting and context window info |
| **Plugins** | `PluginRegistry` | Extensible plugin system |
| **Config** | `parseAgentConfig` | JSON config parsing with env resolution |
| **Stream** | `parsePartialJson` | Streaming JSON parser |

## Auto Provider Detection

Set one environment variable and go:

```bash
# Any one of these:
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=AIza...
export GROQ_API_KEY=gsk_...
export DEEPSEEK_API_KEY=sk-...
export OLLAMA_HOST=http://localhost:11434
```

Gauss auto-detects which provider to use based on available keys.

## Architecture

Gauss-TS is a thin SDK wrapping **[gauss-core](https://github.com/giulio-leone/gauss-core)** (Rust) via NAPI bindings. All heavy lifting — agent loops, tool execution, middleware, graph/workflow orchestration — runs at native speed in Rust.

```
TypeScript SDK (17 modules)
       │
       ▼
  NAPI Bindings (80+ functions)
       │
       ▼
  gauss-core (Rust engine)
```

## Ecosystem

| Package | Language | Description |
|---------|----------|-------------|
| [`gauss-core`](https://github.com/giulio-leone/gauss-core) | Rust | Core engine — NAPI + PyO3 + WASM |
| [`gauss`](https://github.com/giulio-leone/gauss) | TypeScript | This SDK (NAPI bindings) |
| [`gauss-py`](https://github.com/giulio-leone/gauss-py) | Python | Python SDK (PyO3 bindings) |

## License

MIT © [Giulio Leone](https://github.com/giulio-leone)
