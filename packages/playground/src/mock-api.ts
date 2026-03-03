/**
 * Vite plugin that provides mock API endpoints for the playground.
 * Enables the playground to run standalone without a real backend.
 */

import type { Plugin } from "vite";

const DEMO_AGENTS = [
  { name: "assistant", description: "General-purpose AI assistant" },
  { name: "code-reviewer", description: "Reviews code and suggests improvements" },
  { name: "writer", description: "Creative content writer" },
  { name: "analyst", description: "Data analysis and insights" },
];

const DEMO_TOOLS: Record<string, Array<{ name: string; description: string; parameters: Record<string, unknown> }>> = {
  assistant: [
    { name: "web_search", description: "Search the web for information", parameters: { query: { type: "string" } } },
    { name: "calculator", description: "Perform mathematical calculations", parameters: { expression: { type: "string" } } },
  ],
  "code-reviewer": [
    { name: "analyze_code", description: "Static analysis of code", parameters: { code: { type: "string" }, language: { type: "string" } } },
    { name: "suggest_fix", description: "Suggest code fixes", parameters: { issue: { type: "string" } } },
  ],
  writer: [
    { name: "generate_outline", description: "Generate a content outline", parameters: { topic: { type: "string" } } },
  ],
  analyst: [
    { name: "query_data", description: "Query structured data", parameters: { sql: { type: "string" } } },
    { name: "visualize", description: "Create a data visualization", parameters: { type: { type: "string" }, data: { type: "array" } } },
  ],
};

const DEMO_MEMORIES: Record<string, Array<{ key: string; value: string; timestamp: string }>> = {
  assistant: [
    { key: "user_preference", value: "Prefers concise answers", timestamp: new Date().toISOString() },
    { key: "context", value: "Working on a TypeScript project", timestamp: new Date().toISOString() },
  ],
};

function generateStreamResponse(prompt: string, agentName: string): string[] {
  const responses: Record<string, string> = {
    assistant: `I'm the **${agentName}** agent. You asked: "${prompt}"\n\nHere's a thoughtful response with streaming! I can help you with a wide range of tasks including coding, writing, analysis, and more.\n\nFeel free to ask me anything! 🚀`,
    "code-reviewer": `## Code Review\n\nAnalyzing your request: "${prompt}"\n\n### Findings:\n1. ✅ Code structure looks clean\n2. ⚠️ Consider adding error handling\n3. 💡 Suggestion: Extract this into a reusable function\n\nOverall: **Good quality** with minor improvements suggested.`,
    writer: `# Generated Content\n\nBased on your prompt: "${prompt}"\n\n---\n\nHere's a creative piece that demonstrates the writer agent's capabilities. The text flows naturally with proper formatting and structure.\n\n*— Written by Gauss Writer Agent*`,
    analyst: `## Analysis Report\n\n**Query:** ${prompt}\n\n| Metric | Value | Trend |\n|--------|-------|-------|\n| Performance | 94.2% | ↑ |\n| Reliability | 99.1% | → |\n| Efficiency | 87.5% | ↑ |\n\n**Conclusion:** Results look promising with positive trends.`,
  };

  const text = responses[agentName] ?? responses["assistant"]!;
  const words = text.split(" ");
  const events: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? " " : "");
    events.push(`data: ${JSON.stringify({ type: "text-delta", text: word })}\n\n`);
  }

  events.push(`data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`);
  events.push("data: [DONE]\n\n");

  return events;
}

export function mockApiPlugin(): Plugin {
  return {
    name: "gauss-mock-api",
    configureServer(server) {
      // GET /api/agents
      server.middlewares.use("/api/agents", (req, res, next) => {
        if (req.method !== "GET") return next();
        if (req.url && req.url !== "/" && !req.url.startsWith("?")) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(DEMO_AGENTS));
      });

      // GET /api/agents/:name/tools
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/api\/agents\/([^/]+)\/tools/);
        if (!match || req.method !== "GET") return next();
        const name = decodeURIComponent(match[1]);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(DEMO_TOOLS[name] ?? []));
      });

      // GET /api/agents/:name/memory
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/api\/agents\/([^/]+)\/memory/);
        if (!match || req.method !== "GET") return next();
        const name = decodeURIComponent(match[1]);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(DEMO_MEMORIES[name] ?? []));
      });

      // POST /api/chat — SSE streaming response
      server.middlewares.use("/api/chat", (req, res, next) => {
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", () => {
          const data = JSON.parse(body);
          const messages = data.messages ?? [];
          const agentName = data.agent ?? "assistant";
          const lastMsg = messages[messages.length - 1];
          const prompt = lastMsg?.parts
            ?.filter((p: { type: string }) => p.type === "text")
            .map((p: { text: string }) => p.text)
            .join("") ?? "Hello";

          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const events = generateStreamResponse(prompt, agentName);
          let i = 0;

          const interval = setInterval(() => {
            if (i >= events.length) {
              clearInterval(interval);
              res.end();
              return;
            }
            res.write(events[i]);
            i++;
          }, 30);

          req.on("close", () => clearInterval(interval));
        });
      });
    },
  };
}
