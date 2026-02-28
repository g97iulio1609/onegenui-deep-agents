# CLI Reference

The Gauss CLI (`gauss`) provides commands for agent interaction, configuration, and development.

## Installation

```bash
npm install -g @giulio-leone/gauss
# or use npx
npx gauss <command>
```

## Commands

### `gauss chat`

Interactive REPL for conversing with an agent.

```bash
gauss chat
gauss chat --model openai:gpt-4o
gauss chat --system "You are a Python expert"
```

| Flag | Description |
|------|-------------|
| `--model` | LLM model to use |
| `--system` | System prompt |
| `--tools` | Comma-separated tool names |

### `gauss run`

Single-shot agent execution.

```bash
gauss run "Summarize this file" --file ./document.txt
gauss run "Translate to French" --input "Hello world"
```

| Flag | Description |
|------|-------------|
| `--model` | LLM model to use |
| `--file` | Input file path |
| `--input` | Direct text input |
| `--output` | Output file path |
| `--json` | Output as JSON |

### `gauss config`

Manage API keys and configuration.

```bash
gauss config set OPENAI_API_KEY sk-...
gauss config list
gauss config delete OPENAI_API_KEY
gauss config show
```

| Subcommand | Description |
|------------|-------------|
| `set <key> <value>` | Set a configuration value |
| `list` | List all configuration keys |
| `delete <key>` | Delete a configuration value |
| `show` | Show full configuration |

### `gauss usage`

Display token usage and cost breakdown.

```bash
gauss usage
gauss usage --period 7d
gauss usage --model openai:gpt-4o
```

| Flag | Description |
|------|-------------|
| `--period` | Time period (e.g., `1d`, `7d`, `30d`) |
| `--model` | Filter by model |
| `--format` | Output format (`table`, `json`) |

### `gauss demo`

Run built-in demos to explore framework features.

```bash
gauss demo guardrails
gauss demo workflow
gauss demo graph
gauss demo observability
```

| Demo | Description |
|------|-------------|
| `guardrails` | Trip wire and safety middleware demo |
| `workflow` | Workflow DSL execution demo |
| `graph` | Multi-agent graph execution demo |
| `observability` | Telemetry and tracing demo |

### `gauss graph`

Visualize agent graphs.

```bash
gauss graph --format ascii
gauss graph --format mermaid
gauss graph --output graph.md
```

| Flag | Description |
|------|-------------|
| `--format` | Output format (`ascii`, `mermaid`) |
| `--output` | Save to file |

### `gauss dev`

Hot-reload development mode.

```bash
gauss dev
gauss dev --port 3000
gauss dev --watch src/
```

| Flag | Description |
|------|-------------|
| `--port` | Dev server port |
| `--watch` | Watch directory for changes |

### `gauss plugin`

Manage plugins.

```bash
gauss plugin search web-search
gauss plugin install @gauss/plugin-web-search
gauss plugin uninstall @gauss/plugin-web-search
gauss plugin list
```

| Subcommand | Description |
|------------|-------------|
| `search <query>` | Search the plugin marketplace |
| `install <name>` | Install a plugin |
| `uninstall <name>` | Remove a plugin |
| `list` | List installed plugins |

### `gauss init`

Scaffold a new Gauss project.

```bash
gauss init
gauss init --template minimal
gauss init --template full
```

| Flag | Description |
|------|-------------|
| `--template` | Project template (`minimal`, `full`) |
| `--name` | Project name |
| `--dir` | Target directory |

## Configuration File

Gauss reads configuration from `.gaussrc` or `gauss.config.ts`:

```typescript
// gauss.config.ts
export default {
  model: "openai:gpt-4o",
  middleware: ["logging", "caching"],
  telemetry: {
    provider: "langfuse",
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  },
};
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GAUSS_MODEL` | Default model |
| `GAUSS_CONFIG_DIR` | Configuration directory |
| `GAUSS_LOG_LEVEL` | Log level (`debug`, `info`, `warn`, `error`) |

## Related

- [Getting Started](../getting-started.md) — first steps
- [Deployment Guide](../guides/deployment.md) — `gauss dev` and deployment
- [Agents Guide](../guides/agents.md) — agent configuration
