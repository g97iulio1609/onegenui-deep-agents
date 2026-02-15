---
sidebar_position: 7
---

# CLI

OneAgent includes a command-line interface for interactive testing and scripting — similar to Claude Code or OpenCode.

## Installation

```bash
# Global install
npm install -g @onegenui/agent
oneagent --help

# Or use npx
npx @onegenui/agent --help
```

## Quick Start — Direct Prompt

The fastest way to use OneAgent. Just pass a prompt directly:

```bash
oneagent "What is AI?"
```

This streams the response in real-time, just like Claude Code. No subcommand needed.

## Commands

### Direct Prompt (Default)

```bash
oneagent "Explain quantum computing in simple terms"
oneagent "Write a haiku about coding"
```

If the first argument isn't a known command, it's treated as a prompt and streamed directly.

### Interactive Chat (REPL)

```bash
oneagent chat --provider openai --api-key sk-...
```

Start an interactive session with streaming responses. REPL commands:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/exit` | Exit the REPL |
| `/clear` | Clear the screen |
| `/model <id>` | Switch model (e.g., `/model gpt-4o-mini`) |
| `/provider <name>` | Switch provider |
| `/info` | Show current provider and model |

### Single-Shot Run

```bash
oneagent run "What is the capital of France?" --provider openai
```

Execute a single prompt and exit. Ideal for scripting and CI/CD pipelines.

### Config Management

```bash
# Save API key (stored in ~/.oneagentrc with 0600 permissions)
oneagent config set openai sk-...
oneagent config set anthropic sk-ant-...
oneagent config set openrouter sk-or-...

# Set default provider and model
oneagent config set-provider openai
oneagent config set-model gpt-4o-mini

# Show full config (keys masked + defaults)
oneagent config show

# List saved keys (masked)
oneagent config list

# Delete a key
oneagent config delete openai
```

### Demo Modes

```bash
oneagent demo guardrails --provider openai    # Input/output validation
oneagent demo workflow --provider openai       # Step-based workflow execution
oneagent demo graph --provider openai          # Multi-agent graph collaboration
oneagent demo observability --provider openai  # Tracing, metrics, logging
```

## Providers

| Provider | Flag | Default Model | Env Variable |
|----------|------|---------------|--------------|
| OpenAI | `--provider openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Anthropic | `--provider anthropic` | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| Google | `--provider google` | `gemini-2.0-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq | `--provider groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Mistral | `--provider mistral` | `mistral-large-latest` | `MISTRAL_API_KEY` |
| OpenRouter | `--provider openrouter` | `openai/gpt-4o` | `OPENROUTER_API_KEY` |

API key resolution order: `--api-key` flag → `~/.oneagentrc` → environment variable.

:::tip OpenRouter
OpenRouter gives you access to hundreds of models through a single API key. Model names use the `org/model` format (e.g., `anthropic/claude-sonnet-4-20250514`, `google/gemini-2.0-flash`).
:::

## Override Model

```bash
oneagent chat --provider openai --model gpt-4o-mini
oneagent run "Hello" --provider anthropic --model claude-haiku-3-5-20241022
oneagent "Hello" --provider openrouter --model anthropic/claude-sonnet-4-20250514
```

## Config Defaults

Save your preferred provider and model to skip flags:

```bash
# One-time setup
oneagent config set openai sk-...
oneagent config set-provider openai
oneagent config set-model gpt-4o-mini

# Now just use directly
oneagent "What is AI?"
oneagent chat
```

:::note
The saved default model is only used when the active provider matches the saved default provider. If you override `--provider`, the provider's own default model is used unless you also pass `--model`.
:::
