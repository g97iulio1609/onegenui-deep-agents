// =============================================================================
// CLI REPL — Interactive agentic chat mode
// =============================================================================

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { LanguageModel } from "ai";
import { DeepAgent } from "../agent/deep-agent.js";
import { createModel, getDefaultModel, isValidProvider, SUPPORTED_PROVIDERS } from "./providers.js";
import type { ProviderName } from "./providers.js";
import { resolveApiKey, listKeys, ENV_MAP } from "./config.js";
import { color, bold, createSpinner, formatDuration, maskKey, formatMarkdown } from "./format.js";
import { createCliTools } from "./tools.js";
import { readFile } from "./commands/files.js";
import { runBash } from "./commands/bash.js";

const DEFAULT_SYSTEM_PROMPT =
  "You are GaussFlow, an AI coding assistant. You can read files, write files, search code, list directories, and execute bash commands. Use these tools to help the user accomplish their tasks. Be concise and direct.";

export async function startRepl(
  initialModel: LanguageModel,
  providerName: ProviderName,
  apiKey: string,
  modelId?: string,
): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  let currentModel = initialModel;
  let currentProvider = providerName;
  let currentModelId = modelId ?? getDefaultModel(providerName);
  let currentApiKey = apiKey;
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let yoloMode = false;

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  console.log(bold(color("cyan", "\n  ╔══════════════════════════════════════╗")));
  console.log(bold(color("cyan", "  ║       🤖 GaussFlow Interactive       ║")));
  console.log(bold(color("cyan", "  ╚══════════════════════════════════════╝")));
  console.log(color("dim", `  Provider: ${currentProvider} | Model: ${currentModelId}`));
  console.log(color("dim", "  Tools: readFile, writeFile, bash, listFiles, searchFiles"));
  console.log(color("dim", "  Type /help for commands, /exit to quit\n"));

  function promptText(): string {
    const yoloTag = yoloMode ? color("red", "[YOLO]") : "";
    return color("green", `gaussflow:${currentProvider}${yoloTag}> `);
  }

  try {
    while (true) {
      const input = await rl.question(promptText());
      const trimmed = input.trim();
      if (!trimmed) continue;

      // ! shortcut for bash
      if (trimmed.startsWith("!")) {
        const cmd = trimmed.slice(1).trim();
        if (cmd) await handleBash(cmd);
        continue;
      }

      if (trimmed.startsWith("/")) {
        const handled = await handleSlashCommand(trimmed);
        if (handled === "exit") break;
        continue;
      }

      await chat(trimmed);
    }
  } catch (err: unknown) {
    const isEof =
      err instanceof Error &&
      (err.message.includes("readline was closed") ||
        (err as NodeJS.ErrnoException).code === "ERR_USE_AFTER_CLOSE");
    if (!isEof) throw err;
    console.log(color("dim", "\nGoodbye! 👋\n"));
  } finally {
    rl.close();
  }

  async function confirmAction(description: string): Promise<boolean> {
    const answer = await rl.question(color("yellow", `  ⚠ ${description} — Execute? (y/n) `));
    return answer.toLowerCase().startsWith("y");
  }

  async function handleBash(command: string): Promise<void> {
    if (!yoloMode) {
      const ok = await confirmAction(`Run: ${command}`);
      if (!ok) {
        console.log(color("dim", "  Cancelled.\n"));
        return;
      }
    }
    const result = runBash(command);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(color("red", result.stderr));
    if (result.exitCode !== 0) {
      console.log(color("red", `  Exit code: ${result.exitCode}\n`));
    }
  }

  async function chat(prompt: string): Promise<void> {
    history.push({ role: "user", content: prompt });

    const tools = createCliTools({
      yolo: yoloMode,
      confirm: confirmAction,
    });

    const agent = DeepAgent.create({
      model: currentModel,
      instructions: systemPrompt,
      maxSteps: 15,
    })
      .withTools(tools)
      .build();

    const startTime = Date.now();
    const spinner = createSpinner("Thinking");

    try {
      const stream = await agent.stream({
        messages: history as Array<{ role: string; content: unknown }>,
      });

      let response = "";
      let firstChunk = true;
      for await (const chunk of stream.textStream) {
        if (firstChunk) {
          spinner.stop();
          process.stdout.write(color("cyan", "\n🤖 "));
          firstChunk = false;
        }
        process.stdout.write(chunk);
        response += chunk;
      }

      if (response) {
        history.push({ role: "assistant", content: response });
      }

      const elapsed = formatDuration(Date.now() - startTime);
      process.stdout.write(color("dim", `\n\n  ⏱ ${elapsed} | ${history.length} messages\n\n`));
    } catch (err) {
      history.pop();
      const msg = err instanceof Error ? err.message : String(err);
      console.error(color("red", `\n✗ Error: ${msg}\n`));
    } finally {
      spinner.stop();
      await agent.dispose();
    }
  }

  async function handleSlashCommand(cmd: string): Promise<string | void> {
    const parts = cmd.split(/\s+/);
    const command = parts[0]!.toLowerCase();

    switch (command) {
      case "/exit":
      case "/quit":
        console.log(color("dim", "Goodbye! 👋\n"));
        return "exit";

      case "/help":
        console.log(bold("\nCommands:"));
        console.log("  /help              Show this help");
        console.log("  /exit              Exit the REPL");
        console.log("  /clear             Clear the screen");
        console.log("");
        console.log(bold("  Provider & Model:"));
        console.log("  /model <name>      Switch model (e.g. /model gpt-4o-mini)");
        console.log("  /provider <name>   Switch provider");
        console.log("  /info              Show current provider and model");
        console.log("  /settings          Show all current settings");
        console.log("");
        console.log(bold("  Agent:"));
        console.log("  /system [prompt]   Get/set system prompt");
        console.log("  /yolo [on|off]     Toggle YOLO mode (skip confirmations)");
        console.log("");
        console.log(bold("  File & Shell:"));
        console.log("  /read <file>       Read and display a file");
        console.log("  /bash <cmd>        Execute a bash command");
        console.log("  !<cmd>             Shortcut for /bash");
        console.log("");
        console.log(bold("  History:"));
        console.log("  /history           Show conversation history");
        console.log("  /clear-history     Clear conversation history\n");
        break;

      case "/clear":
        process.stdout.write("\x1Bc");
        break;

      case "/info":
        console.log(color("cyan", `  Provider: ${currentProvider}`));
        console.log(color("cyan", `  Model: ${currentModelId}`));
        console.log(color("cyan", `  YOLO: ${yoloMode ? "ON" : "OFF"}\n`));
        break;

      case "/model": {
        const newModel = parts[1];
        if (!newModel) {
          console.log(color("yellow", `  Current model: ${currentModelId}`));
          break;
        }
        try {
          currentModel = await createModel(currentProvider, currentApiKey, newModel);
          currentModelId = newModel;
          console.log(color("green", `  ✓ Switched to model: ${currentModelId}\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(color("red", `  ✗ Failed to switch model: ${msg}\n`));
        }
        break;
      }

      case "/provider": {
        const newProvider = parts[1];
        if (!newProvider) {
          console.log(color("yellow", `  Current provider: ${currentProvider}`));
          console.log(color("dim", `  Available: ${SUPPORTED_PROVIDERS.join(", ")}\n`));
          break;
        }
        if (!isValidProvider(newProvider)) {
          console.log(color("red", `  ✗ Unknown provider: ${newProvider}`));
          console.log(color("dim", `  Available: ${SUPPORTED_PROVIDERS.join(", ")}\n`));
          break;
        }
        const key = resolveApiKey(newProvider);
        if (!key) {
          console.log(color("red", `  ✗ No API key for ${newProvider}. Use: gaussflow config set ${newProvider} <key>\n`));
          break;
        }
        try {
          const newModelId = getDefaultModel(newProvider);
          currentModel = await createModel(newProvider, key, newModelId);
          currentProvider = newProvider;
          currentModelId = newModelId;
          currentApiKey = key;
          console.log(color("green", `  ✓ Switched to ${currentProvider} (${currentModelId})\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(color("red", `  ✗ Failed to switch provider: ${msg}\n`));
        }
        break;
      }

      case "/system": {
        const newPrompt = parts.slice(1).join(" ").trim();
        if (!newPrompt) {
          console.log(bold("\n  System prompt:"));
          console.log(color("dim", `  ${systemPrompt}\n`));
        } else {
          systemPrompt = newPrompt;
          console.log(color("green", "  ✓ System prompt updated.\n"));
        }
        break;
      }

      case "/yolo": {
        const arg = parts[1]?.toLowerCase();
        if (arg === "on") {
          yoloMode = true;
        } else if (arg === "off") {
          yoloMode = false;
        } else {
          yoloMode = !yoloMode;
        }
        const status = yoloMode
          ? color("red", "ON — commands execute without confirmation")
          : color("green", "OFF — will ask before executing");
        console.log(`  YOLO mode: ${status}\n`);
        break;
      }

      case "/read": {
        const filePath = parts[1];
        if (!filePath) {
          console.log(color("red", "  Usage: /read <file-path>\n"));
          break;
        }
        try {
          const result = readFile(filePath);
          console.log(color("dim", `\n  ─── ${result.path} ───`));
          console.log(result.content);
          console.log(color("dim", "  ─────────\n"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(color("red", `  ✗ ${msg}\n`));
        }
        break;
      }

      case "/bash": {
        const bashCmd = parts.slice(1).join(" ").trim();
        if (!bashCmd) {
          console.log(color("red", "  Usage: /bash <command>\n"));
          break;
        }
        await handleBash(bashCmd);
        break;
      }

      case "/settings":
        console.log(bold("\n  ⚙ Settings:"));
        console.log(`  Provider:  ${color("cyan", currentProvider)}`);
        console.log(`  Model:     ${color("cyan", currentModelId)}`);
        console.log(`  API Key:   ${color("dim", maskKey(currentApiKey))}`);
        console.log(`  YOLO:      ${yoloMode ? color("red", "ON") : color("green", "OFF")}`);
        console.log(`  System:    ${color("dim", systemPrompt.length > 60 ? systemPrompt.slice(0, 57) + "..." : systemPrompt)}`);
        console.log(`  Available: ${color("dim", SUPPORTED_PROVIDERS.join(", "))}`);
        {
          const allKeys = listKeys();
          const providerSources: Array<{ name: string; source: string }> = [];
          for (const p of SUPPORTED_PROVIDERS) {
            if (allKeys[p]) {
              providerSources.push({ name: p, source: "config" });
            } else if (ENV_MAP[p] && process.env[ENV_MAP[p]!]) {
              providerSources.push({ name: p, source: "env" });
            }
          }
          if (providerSources.length > 0) {
            console.log(bold("  Configured providers:"));
            for (const { name, source } of providerSources) {
              const k = allKeys[name] ?? process.env[ENV_MAP[name]!] ?? "";
              const masked = maskKey(k);
              const active = name === currentProvider ? color("green", " (active)") : "";
              const srcLabel = source === "env" ? color("yellow", " [env]") : "";
              console.log(`    ${name}: ${color("dim", masked)}${active}${srcLabel}`);
            }
          }
        }
        console.log();
        break;

      case "/history":
        if (history.length === 0) {
          console.log(color("dim", "  No conversation history.\n"));
        } else {
          console.log(bold("\n  Conversation History:"));
          for (const msg of history) {
            const prefix = msg.role === "user" ? color("green", "  You: ") : color("cyan", "  AI:  ");
            const content = msg.content.length > 80 ? msg.content.slice(0, 77) + "..." : msg.content;
            console.log(`${prefix}${content}`);
          }
          console.log("");
        }
        break;

      case "/clear-history":
        history.length = 0;
        console.log(color("green", "  ✓ Conversation history cleared.\n"));
        break;

      default:
        console.log(color("yellow", `  Unknown command: ${command}. Type /help for available commands.\n`));
    }
  }
}
