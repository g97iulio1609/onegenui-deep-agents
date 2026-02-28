#!/usr/bin/env node
/**
 * Gauss CLI — command-line interface for the Gauss agentic framework.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { templates } from "./templates/index.js";

const VERSION = "2.4.0";

const VALID_TEMPLATES = Object.keys(templates);
const VALID_TARGETS = ["node", "edge", "docker"] as const;
const VALID_PLATFORMS = ["vercel", "cloudflare", "docker", "aws-lambda"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function handleInit(
  name: string | undefined,
  opts: { template: string },
): Promise<void> {
  const templateName = opts.template ?? "basic";

  if (!VALID_TEMPLATES.includes(templateName)) {
    console.error(
      `Unknown template "${templateName}". Available: ${VALID_TEMPLATES.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const projectName = name ?? "my-gauss-project";
  const projectDir = resolve(process.cwd(), projectName);
  const tpl = templates[templateName];

  console.log(`\n⚡ Scaffolding Gauss project: ${projectName}`);
  console.log(`  Template: ${templateName} — ${tpl.description}\n`);

  for (const [filePath, content] of Object.entries(tpl.files)) {
    const fullPath = join(projectDir, filePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Inject project name into package.json
    let finalContent = content;
    if (filePath === "package.json") {
      try {
        const pkg = JSON.parse(content);
        pkg.name = projectName;
        finalContent = JSON.stringify(pkg, null, 2);
      } catch {
        // keep original content
      }
    }

    await writeFile(fullPath, finalContent, "utf-8");
    console.log(`  ✓ ${filePath}`);
  }

  console.log(`\n✨ Project created at ${projectDir}`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${projectName}`);
  console.log(`  npm install`);
  console.log(`  # Set your API key in .env`);
  console.log(`  npx gauss dev\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev
// ─────────────────────────────────────────────────────────────────────────────

async function handleDev(opts: {
  port: string;
  playground?: boolean;
}): Promise<void> {
  const port = parseInt(opts.port, 10) || 3000;

  console.log(`\n⚡ Gauss dev server starting on port ${port}...`);

  if (opts.playground) {
    console.log(`  🎮 Playground UI enabled`);
  }

  // Check for entry file
  const entryPoints = ["src/index.ts", "src/agent.ts", "index.ts"];
  let entry: string | undefined;

  for (const ep of entryPoints) {
    if (existsSync(join(process.cwd(), ep))) {
      entry = ep;
      break;
    }
  }

  if (!entry) {
    console.error(
      "No entry file found (src/index.ts, src/agent.ts, or index.ts)",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`  📄 Entry: ${entry}`);
  console.log(`  👀 Watching for changes...\n`);

  // In a real implementation this would use chokidar + child_process
  // to watch files and restart the agent process.
  const { spawn } = await import("node:child_process");
  const child = spawn("npx", ["tsx", "--watch", entry], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  child.on("error", (err) => {
    console.error(`Dev server error: ${err.message}`);
    process.exitCode = 1;
  });

  await new Promise<void>((_, reject) => {
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Process exited with code ${code}`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

async function handleBuild(opts: { target: string }): Promise<void> {
  const target = opts.target ?? "node";

  if (!(VALID_TARGETS as readonly string[]).includes(target)) {
    console.error(
      `Unknown target "${target}". Available: ${VALID_TARGETS.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n🔨 Building for target: ${target}`);

  const outDir = resolve(process.cwd(), "dist");

  switch (target) {
    case "node": {
      const { execSync } = await import("node:child_process");
      console.log("  Running tsc...");
      execSync("npx tsc", { stdio: "inherit" });
      console.log(`  ✓ Build output: ${outDir}\n`);
      break;
    }
    case "edge": {
      const { execSync } = await import("node:child_process");
      console.log("  Bundling for edge runtime...");
      execSync("npx tsc", { stdio: "inherit" });
      console.log(`  ✓ Edge bundle: ${outDir}\n`);
      break;
    }
    case "docker": {
      const dockerfilePath = join(process.cwd(), "Dockerfile");
      if (!existsSync(dockerfilePath)) {
        await writeFile(dockerfilePath, generateDockerfile(), "utf-8");
        console.log("  ✓ Generated Dockerfile");
      }
      const { execSync } = await import("node:child_process");
      console.log("  Running tsc...");
      execSync("npx tsc", { stdio: "inherit" });
      console.log(`  ✓ Build output: ${outDir}`);
      console.log(`  🐳 Run: docker build -t my-gauss-agent .\n`);
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deploy
// ─────────────────────────────────────────────────────────────────────────────

async function handleDeploy(opts: { platform: string }): Promise<void> {
  const platform = opts.platform ?? "docker";

  if (!(VALID_PLATFORMS as readonly string[]).includes(platform)) {
    console.error(
      `Unknown platform "${platform}". Available: ${VALID_PLATFORMS.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n🚀 Preparing deployment for: ${platform}\n`);

  switch (platform) {
    case "vercel": {
      const config = {
        version: 2,
        builds: [{ src: "dist/index.js", use: "@vercel/node" }],
        routes: [{ src: "/(.*)", dest: "dist/index.js" }],
      };
      await writeFile(
        join(process.cwd(), "vercel.json"),
        JSON.stringify(config, null, 2),
        "utf-8",
      );
      console.log("  ✓ Generated vercel.json");
      console.log("  Run: vercel deploy\n");
      break;
    }
    case "cloudflare": {
      const config = `\
name = "gauss-agent"
main = "dist/index.js"
compatibility_date = "${new Date().toISOString().split("T")[0]}"

[triggers]
crons = []
`;
      await writeFile(
        join(process.cwd(), "wrangler.toml"),
        config,
        "utf-8",
      );
      console.log("  ✓ Generated wrangler.toml");
      console.log("  Run: wrangler deploy\n");
      break;
    }
    case "docker": {
      await writeFile(
        join(process.cwd(), "Dockerfile"),
        generateDockerfile(),
        "utf-8",
      );
      console.log("  ✓ Generated Dockerfile");
      console.log("  Run: docker build -t gauss-agent . && docker run -p 3000:3000 gauss-agent\n");
      break;
    }
    case "aws-lambda": {
      const config = {
        AWSTemplateFormatVersion: "2010-09-09",
        Transform: "AWS::Serverless-2016-10-31",
        Resources: {
          GaussFunction: {
            Type: "AWS::Serverless::Function",
            Properties: {
              Handler: "dist/index.handler",
              Runtime: "nodejs20.x",
              MemorySize: 512,
              Timeout: 30,
              Events: {
                Api: {
                  Type: "Api",
                  Properties: { Path: "/{proxy+}", Method: "ANY" },
                },
              },
            },
          },
        },
      };
      await writeFile(
        join(process.cwd(), "template.yaml"),
        JSON.stringify(config, null, 2),
        "utf-8",
      );
      console.log("  ✓ Generated template.yaml (SAM)");
      console.log("  Run: sam build && sam deploy --guided\n");
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Playground
// ─────────────────────────────────────────────────────────────────────────────

async function handlePlayground(opts: { port: string }): Promise<void> {
  const port = parseInt(opts.port, 10) || 4000;

  console.log(`\n🎮 Starting Gauss Playground on port ${port}...`);
  console.log(`  📡 API:  http://localhost:${port}/api/agents`);
  console.log(`  🌐 UI:   http://localhost:${port}\n`);

  // Delegate to the existing playground launcher
  const { startPlayground } = await import("./playground.js");
  await startPlayground({
    port,
    agents: [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Info
// ─────────────────────────────────────────────────────────────────────────────

async function handleInfo(): Promise<void> {
  console.log(`\n📋 Gauss Project Info\n`);
  console.log(`  Version: ${VERSION}`);
  console.log(`  Runtime: Node.js ${process.version}`);
  console.log(`  Platform: ${process.platform} (${process.arch})`);

  // Try to read project package.json
  const pkgPath = join(process.cwd(), "package.json");
  if (existsSync(pkgPath)) {
    try {
      const raw = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      console.log(`  Project: ${pkg.name ?? "unknown"} v${pkg.version ?? "0.0.0"}`);

      // List dependencies that look like gauss-related
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const gaussDeps = Object.entries(deps).filter(
        ([k]) => k.includes("gauss") || k.includes("ai-sdk"),
      );
      if (gaussDeps.length > 0) {
        console.log(`\n  Dependencies:`);
        for (const [name, version] of gaussDeps) {
          console.log(`    ${name}: ${version}`);
        }
      }
    } catch {
      // ignore parse errors
    }
  } else {
    console.log(`  ⚠ No package.json found in current directory`);
  }

  // List available templates
  console.log(`\n  Available templates:`);
  for (const [name, tpl] of Object.entries(templates)) {
    console.log(`    ${name.padEnd(16)} ${tpl.description}`);
  }

  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateDockerfile(): string {
  return `\
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — dynamic commander import
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { Command } = await import("commander");

  const program = new Command();

  program
    .name("gauss")
    .description("Gauss — AI Agent Framework CLI")
    .version(VERSION);

  program
    .command("init [name]")
    .description("Scaffold a new Gauss project")
    .option("-t, --template <template>", "Project template (basic, rag, multi-agent, workflow)", "basic")
    .action(handleInit);

  program
    .command("dev")
    .description("Start development server")
    .option("-p, --port <port>", "Server port", "3000")
    .option("--playground", "Enable playground UI")
    .action(handleDev);

  program
    .command("build")
    .description("Build for production")
    .option("--target <target>", "Build target (node, edge, docker)", "node")
    .action(handleBuild);

  program
    .command("deploy")
    .description("Deploy agent")
    .option("--platform <platform>", "Deployment platform (vercel, cloudflare, docker, aws-lambda)", "docker")
    .action(handleDeploy);

  program
    .command("playground")
    .description("Start interactive playground")
    .option("-p, --port <port>", "Playground port", "4000")
    .action(handlePlayground);

  program
    .command("info")
    .description("Show project info")
    .action(handleInfo);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(
    `\n✗ Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
