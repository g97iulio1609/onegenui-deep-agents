// =============================================================================
// Template: Basic — Single-agent starter project
// =============================================================================

export const files: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "my-gauss-agent",
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
import { myAgent } from "./agent.js";

async function main() {
  const result = await myAgent.run("Hello! What can you do?");
  console.log(result.text);
}

main().catch(console.error);
`,

  "src/agent.ts": `\
import { agent } from "@giulio-leone/gauss";
import { openai } from "@ai-sdk/openai";

export const myAgent = agent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a helpful assistant. Be concise and friendly.",
}).build();
`,

  ".env.example": `\
# AI Provider API Keys
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENERATIVE_AI_API_KEY=...
`,
};
