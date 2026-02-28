// =============================================================================
// Template: Workflow — Workflow DSL with step orchestration
// =============================================================================

export const files: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "my-gauss-workflow",
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "npx tsx src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
      },
      dependencies: {
        "@giulio-leone/gauss": "^2.0.0",
        "@ai-sdk/openai": "^3.0.0",
        zod: "^3.23.0",
      },
      devDependencies: {
        typescript: "^5.5.0",
        tsx: "^4.0.0",
      },
    },
    null,
    2,
  ),

  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: "dist",
        rootDir: "src",
        declaration: true,
      },
      include: ["src"],
    },
    null,
    2,
  ),

  "src/index.ts": `\
import { contentPipeline } from "./agent.js";

async function main() {
  const result = await contentPipeline.run({
    topic: "The future of AI agents in software development",
  });

  console.log("=== Pipeline Output ===");
  console.log(result.text);
}

main().catch(console.error);
`,

  "src/agent.ts": `\
import { agent, workflow } from "@giulio-leone/gauss";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Step 1: Research agent
const researcher = agent({
  model: openai("gpt-4o"),
  instructions: \`You are a research analyst. Gather key facts about the given topic.
Output a structured summary with bullet points.\`,
}).build();

// Step 2: Writer agent
const writer = agent({
  model: openai("gpt-4o"),
  instructions: \`You are a professional writer. Take research notes and produce a polished article.
Write clearly, use headers, and make it engaging.\`,
}).build();

// Step 3: Editor agent
const editor = agent({
  model: openai("gpt-4o-mini"),
  instructions: \`You are an editor. Review the article for clarity, grammar, and completeness.
Provide the final polished version.\`,
}).build();

// Define the workflow pipeline
export const contentPipeline = workflow({
  name: "content-pipeline",
  inputSchema: z.object({
    topic: z.string().describe("The topic to write about"),
  }),
  steps: [
    {
      id: "research",
      agent: researcher,
      input: (ctx) => \`Research this topic thoroughly: \${ctx.input.topic}\`,
    },
    {
      id: "write",
      agent: writer,
      dependsOn: ["research"],
      input: (ctx) => \`Write an article based on this research:\\n\${ctx.steps.research.text}\`,
    },
    {
      id: "edit",
      agent: editor,
      dependsOn: ["write"],
      input: (ctx) => \`Edit and polish this article:\\n\${ctx.steps.write.text}\`,
    },
  ],
  output: "edit",
});
`,

  ".env.example": `\
# AI Provider API Keys
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENERATIVE_AI_API_KEY=...
`,
};
