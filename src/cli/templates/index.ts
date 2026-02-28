// =============================================================================
// Template barrel — exports all scaffold templates as { files } maps.
// =============================================================================

import { files as basicFiles } from "./basic.js";
import { files as workflowFiles } from "./workflow.js";

export interface TemplateDefinition {
  description: string;
  files: Record<string, string>;
}

// ── Helpers to build file maps for templates that exist as single-file sources ─

function singleAgentFiles(
  name: string,
  agentCode: string,
): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: `my-gauss-${name}`,
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
    "src/agent.ts": agentCode,
    ".env.example": `\
# AI Provider API Keys
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENERATIVE_AI_API_KEY=...
`,
  };
}

// ── RAG template ──────────────────────────────────────────────────────────────

const ragAgentCode = `\
import { agent, rag, InMemoryVectorStore } from "@giulio-leone/gauss";
import { openai } from "@ai-sdk/openai";

const vectorStore = new InMemoryVectorStore();

const ragPipeline = rag({
  vectorStore,
  topK: 5,
  minScore: 0.7,
});

export const myAgent = agent({
  model: openai("gpt-4o"),
  instructions: \\\`You are a documentation assistant.
Answer questions using ONLY the provided context.
If the context doesn't contain the answer, say so.\\\`,
  rag: ragPipeline,
}).build();
`;

// ── Multi-Agent template ──────────────────────────────────────────────────────

const multiAgentCode = `\
import { agent, graph } from "@giulio-leone/gauss";
import { openai } from "@ai-sdk/openai";

const researcher = agent({
  model: openai("gpt-4o"),
  instructions: \\\`You are a research analyst. Gather and summarize key facts about the given topic.
Output a structured summary with bullet points.\\\`,
}).build();

const writer = agent({
  model: openai("gpt-4o"),
  instructions: \\\`You are a professional writer. Take research notes and produce a polished article.
Write clearly, use headers, and make it engaging.\\\`,
}).build();

const editor = agent({
  model: openai("gpt-4o-mini"),
  instructions: \\\`You are an editor. Review the article for clarity, grammar, and completeness.
Provide the final polished version.\\\`,
}).build();

export const myAgent = graph({
  name: "article-pipeline",
  nodes: {
    research: { agent: researcher, inputs: ["topic"] },
    write: { agent: writer, inputs: ["research"], dependsOn: ["research"] },
    edit: { agent: editor, inputs: ["write"], dependsOn: ["write"] },
  },
  output: "edit",
});
`;

// ── Exported template registry ────────────────────────────────────────────────

export const templates: Record<string, TemplateDefinition> = {
  basic: {
    description: "Simple single-agent starter project",
    files: basicFiles,
  },
  rag: {
    description: "Retrieval-Augmented Generation pipeline",
    files: singleAgentFiles("rag", ragAgentCode),
  },
  "multi-agent": {
    description: "Multi-agent orchestration with graph workflow",
    files: singleAgentFiles("multi-agent", multiAgentCode),
  },
  workflow: {
    description: "Workflow DSL with step orchestration",
    files: workflowFiles,
  },
};
