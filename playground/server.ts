import express from "express";
import cors from "cors";
import { Agent, OPENAI_DEFAULT, ANTHROPIC_DEFAULT, GOOGLE_DEFAULT } from "../src/sdk/index.js";
import type { ProviderType } from "../src/sdk/index.js";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory config
let config = {
  openaiKey: process.env.OPENAI_API_KEY || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  googleKey: process.env.GOOGLE_API_KEY || "",
};

// Settings endpoint
app.get("/api/config", (_req, res) => {
  res.json({
    hasOpenai: !!config.openaiKey,
    hasAnthropic: !!config.anthropicKey,
    hasGoogle: !!config.googleKey,
  });
});

app.post("/api/config", (req, res) => {
  if (req.body.openaiKey !== undefined) config.openaiKey = req.body.openaiKey;
  if (req.body.anthropicKey !== undefined) config.anthropicKey = req.body.anthropicKey;
  if (req.body.googleKey !== undefined) config.googleKey = req.body.googleKey;
  res.json({ ok: true });
});

// List available agents based on configured keys
app.get("/api/agents", (_req, res) => {
  const agents: Array<{ id: string; name: string; model: string; provider: string; description: string; tools: string[] }> = [];
  if (config.openaiKey) {
    agents.push({ id: "openai", name: "OpenAI Agent", model: OPENAI_DEFAULT, provider: "openai", description: `Model: ${OPENAI_DEFAULT}`, tools: [] });
  }
  if (config.anthropicKey) {
    agents.push({ id: "anthropic", name: "Anthropic Agent", model: ANTHROPIC_DEFAULT, provider: "anthropic", description: `Model: ${ANTHROPIC_DEFAULT}`, tools: [] });
  }
  if (config.googleKey) {
    agents.push({ id: "google", name: "Google Agent", model: GOOGLE_DEFAULT, provider: "google", description: `Model: ${GOOGLE_DEFAULT}`, tools: [] });
  }
  res.json(agents);
});

// Invoke agent — SSE streaming
app.post("/api/agents/:id/invoke", async (req, res) => {
  const { id } = req.params;
  const { prompt, history } = req.body;

  // Determine provider config
  let model: string;
  let apiKey: string;
  let provider: ProviderType;
  switch (id) {
    case "openai":
      model = OPENAI_DEFAULT;
      apiKey = config.openaiKey;
      provider = "openai";
      break;
    case "anthropic":
      model = ANTHROPIC_DEFAULT;
      apiKey = config.anthropicKey;
      provider = "anthropic";
      break;
    case "google":
      model = GOOGLE_DEFAULT;
      apiKey = config.googleKey;
      provider = "google";
      break;
    default:
      res.status(404).json({ error: "Unknown agent" });
      return;
  }

  if (!apiKey) {
    res.status(400).json({ error: "API key not configured for this provider" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const agent = new Agent({
      name: `playground-${id}`,
      provider,
      model,
      providerOptions: { apiKey },
      instructions: "You are a helpful assistant in the Gauss playground. Be concise and informative.",
    });

    const messages = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    messages.push({ role: "user" as const, content: prompt });

    let fullText = "";
    for await (const event of agent.streamIter(messages)) {
      if (event.type === "text_delta") {
        fullText += event.text ?? "";
        res.write(`data: ${JSON.stringify({ type: "text", content: event.text ?? "" })}\n\n`);
      } else if (event.type === "tool_call") {
        res.write(`data: ${JSON.stringify({ type: "tool_call", name: event.toolCall?.name, args: event.toolCall?.arguments })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", content: fullText })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  }
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.log(`🚀 Gauss Playground API running on http://localhost:${PORT}`);
});
