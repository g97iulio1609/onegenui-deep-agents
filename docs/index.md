# Gauss Framework

The most comprehensive agentic AI framework — hexagonal architecture, multi-runtime support, plugin system, and multi-agent collaboration.

## Features

- **55+ Port Interfaces** — vector stores, telemetry, voice, auth, embedding, and more
- **53+ Adapter Implementations** — plug-and-play backends for every port
- **Multi-Runtime** — Node.js, Deno, Edge, Browser
- **Agent System** — tool management, streaming, resilience (circuit breaker, rate limiter)
- **Workflow DSL** — declarative workflow definition and execution
- **Graph Execution** — multi-agent graphs, supervisor, worker pools, teams
- **RAG Pipeline** — ingest → chunk → embed → store → query
- **Middleware Stack** — caching, trip wire, prompt caching, tool call patching, HITL
- **Plugin System** — marketplace, registry, manifests, hot reload
- **CLI** — REPL, config, usage tracking, graph visualization, dev mode
- **2000+ Tests** — comprehensive test coverage

## Quick Start

```bash
npm install @giulio-leone/gauss
```

```typescript
import { Agent } from "@giulio-leone/gauss";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  tools: [/* your tools */],
});

const result = await agent.run("Summarize this document");
console.log(result.text);
```

## Documentation

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started.md) | Installation, first agent, basic concepts |
| [Architecture](./architecture.md) | Hexagonal architecture, ports & adapters |
| [Agents Guide](./guides/agents.md) | Creating agents, tools, streaming |
| [Workflows Guide](./guides/workflows.md) | Workflow DSL, graph execution |
| [RAG Guide](./guides/rag.md) | RAG pipeline, vector stores, embeddings |
| [Middleware Guide](./guides/middleware.md) | Middleware system, trip wire, caching |
| [Deployment Guide](./guides/deployment.md) | Server adapters, bundler, targets |
| [Ports API](./api/ports.md) | All port interfaces |
| [Adapters API](./api/adapters.md) | All adapter implementations |
| [Middleware API](./api/middleware.md) | Middleware reference |
| [CLI Reference](./api/cli.md) | CLI commands |

## Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│                   Application                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │  Agents  │  │ Workflows│  │  Graph Engine  │ │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘ │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │              Middleware Stack               │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │             Port Interfaces                │ │
│  │  (VectorStore, Telemetry, Auth, Voice...)  │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │          Adapter Implementations           │ │
│  │  (Pinecone, Langfuse, JWT, ElevenLabs...)  │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## License

MIT
