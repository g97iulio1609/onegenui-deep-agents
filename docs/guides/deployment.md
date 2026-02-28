# Deployment Guide

## Overview

Gauss supports multiple deployment targets through server adapters, a bundler system, and multi-runtime support.

## Server Adapters

### MCP Server

Expose agents via the Model Context Protocol:

```typescript
import { McpServer } from "@giulio-leone/gauss/server";

const server = new McpServer({
  agent: myAgent,
  port: 3001,
  tools: true,  // Expose agent tools via MCP
});

await server.start();
```

### Streamable HTTP Handler

For standard HTTP servers with streaming support:

```typescript
import { StreamableHttpHandler } from "@giulio-leone/gauss/server";

const handler = new StreamableHttpHandler({
  agent: myAgent,
});

// Use with any HTTP framework
import { createServer } from "http";
createServer(handler.handle).listen(3000);
```

### Playground

Interactive playground for development and testing:

```typescript
import { PlaygroundAPI } from "@giulio-leone/gauss/server";

const playground = new PlaygroundAPI({
  agent: myAgent,
  websocket: true,
});

await playground.start({ port: 4000 });
```

## Runtime Targets

### Node.js

```typescript
import { Agent } from "@giulio-leone/gauss/node";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  runtime: "node",
});
```

### Deno

```typescript
import { Agent } from "@giulio-leone/gauss/deno";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  runtime: "deno",
});
```

### Edge (Cloudflare Workers / Vercel Edge)

```typescript
import { Agent } from "@giulio-leone/gauss/edge";

export default {
  async fetch(request: Request): Promise<Response> {
    const agent = await Agent.auto({
      model: "openai:gpt-4o",
      runtime: "edge",
    });

    const result = await agent.run("Hello from the edge!");
    return new Response(result.text);
  },
};
```

### Browser

```typescript
import { Agent } from "@giulio-leone/gauss/browser";

const agent = await Agent.auto({
  model: "openai:gpt-4o",
  runtime: "browser",
});

const result = await agent.run(userInput);
document.getElementById("output").textContent = result.text;
```

## Bundler

The Gauss bundler packages agents for deployment:

```typescript
import { BundlerPort } from "@giulio-leone/gauss";

const bundler = new GaussBundler({
  entry: "./src/agent.ts",
  output: "./dist",
  target: "node", // "node" | "deno" | "edge" | "browser"
  minify: true,
  sourcemap: true,
});

await bundler.bundle();
```

## ACP Server

Agent Communication Protocol server for inter-agent communication:

```typescript
import { AcpServer } from "@giulio-leone/gauss";

const acp = new AcpServer({
  agents: [agentA, agentB, agentC],
  port: 5000,
  discovery: true,
});

await acp.start();
```

## Deployment Checklist

| Step | Description |
|------|-------------|
| ✅ Configure environment | Set API keys, secrets via env vars |
| ✅ Choose runtime | Node.js, Deno, Edge, or Browser |
| ✅ Select server adapter | MCP, HTTP, or Playground |
| ✅ Configure middleware | Logging, caching, guardrails |
| ✅ Set up monitoring | Telemetry, tracing, metrics |
| ✅ Bundle & deploy | Use bundler for target runtime |
| ✅ Health checks | Agent lifecycle management |

## Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `PINECONE_API_KEY` | Pinecone vector store key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse telemetry key |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |

## Related

- [Architecture](../architecture.md) — multi-runtime design
- [Agents Guide](./agents.md) — agent configuration
- [CLI Reference](../api/cli.md) — `gauss dev` and `gauss init`
