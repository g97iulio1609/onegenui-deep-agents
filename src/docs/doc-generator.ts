import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, basename, relative } from "path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DocGeneratorOptions {
  srcDir: string;
  outputDir: string;
  title?: string;
  baseUrl?: string;
}

export interface DocPage {
  path: string;
  title: string;
  content: string;
  category: string;
}

export interface PortDoc {
  name: string;
  fileName: string;
  interfaces: InterfaceDoc[];
  types: string[];
  description: string;
  category: string;
}

export interface InterfaceDoc {
  name: string;
  methods: MethodDoc[];
  description: string;
}

export interface MethodDoc {
  name: string;
  signature: string;
  description: string;
}

export interface AdapterDoc {
  name: string;
  dirName: string;
  implementations: string[];
  portName: string;
  category: string;
}

/* ------------------------------------------------------------------ */
/*  Category mapping                                                   */
/* ------------------------------------------------------------------ */

const CATEGORY_MAP: Record<string, string> = {
  "vector-store": "Storage",
  memory: "Storage",
  "working-memory": "Storage",
  "agent-memory": "Storage",
  "storage-domain": "Storage",
  "object-storage": "Storage",
  embedding: "AI / ML",
  model: "AI / ML",
  reranking: "AI / ML",
  "entity-extractor": "AI / ML",
  "knowledge-graph": "AI / ML",
  chunking: "Processing",
  document: "Processing",
  "partial-json": "Processing",
  serializer: "Processing",
  validation: "Processing",
  telemetry: "Observability",
  tracing: "Observability",
  metrics: "Observability",
  logging: "Observability",
  "cost-tracker": "Observability",
  auth: "Security",
  policy: "Security",
  sandbox: "Security",
  voice: "I/O",
  "semantic-scraping": "I/O",
  filesystem: "I/O",
  server: "Infrastructure",
  "http-server": "Infrastructure",
  "mcp-server": "Infrastructure",
  mcp: "Infrastructure",
  acp: "Infrastructure",
  runtime: "Infrastructure",
  queue: "Infrastructure",
  "save-queue": "Infrastructure",
  bundler: "Tooling",
  compiler: "Tooling",
  deployer: "Tooling",
  "hot-reload": "Tooling",
  di: "Core",
  middleware: "Core",
  plugin: "Core",
  "plugin-registry": "Core",
  "plugin-manifest": "Core",
  workflow: "Orchestration",
  "agent-network": "Orchestration",
  consensus: "Orchestration",
  suspension: "Orchestration",
  "graph-visualization": "Orchestration",
  "tool-composition": "Orchestration",
  "skill-matcher": "Orchestration",
  skills: "Orchestration",
  datasets: "AI / ML",
  learning: "AI / ML",
  "token-counter": "Observability",
};

function categoryFor(name: string): string {
  return CATEGORY_MAP[name] ?? "Other";
}

/* ------------------------------------------------------------------ */
/*  Parsing helpers                                                    */
/* ------------------------------------------------------------------ */

const INTERFACE_RE =
  /(?:\/\*\*\s*([\s\S]*?)\s*\*\/\s*)?export\s+interface\s+(\w+)\s*(?:extends\s+[\w<>,\s]+)?\s*\{/g;

const METHOD_RE =
  /(?:\/\*\*\s*([\s\S]*?)\s*\*\/\s*)?([\w]+)\s*(\([^)]*\)\s*:\s*[^;]+);/g;

const TYPE_EXPORT_RE = /export\s+(?:type|enum|const)\s+(\w+)/g;

function extractDescription(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\*\s?/g, "")
    .replace(/@\w+[^\n]*/g, "")
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
}

function parseInterfaces(source: string): InterfaceDoc[] {
  const results: InterfaceDoc[] = [];
  let match: RegExpExecArray | null;

  INTERFACE_RE.lastIndex = 0;
  while ((match = INTERFACE_RE.exec(source)) !== null) {
    const description = extractDescription(match[1]);
    const name = match[2];

    // Find body between braces
    const start = source.indexOf("{", match.index + match[0].length - 1);
    let depth = 1;
    let pos = start + 1;
    while (pos < source.length && depth > 0) {
      if (source[pos] === "{") depth++;
      if (source[pos] === "}") depth--;
      pos++;
    }
    const body = source.slice(start + 1, pos - 1);

    const methods: MethodDoc[] = [];
    let mMatch: RegExpExecArray | null;
    METHOD_RE.lastIndex = 0;
    while ((mMatch = METHOD_RE.exec(body)) !== null) {
      methods.push({
        name: mMatch[2],
        signature: `${mMatch[2]}${mMatch[3].trim()}`,
        description: extractDescription(mMatch[1]),
      });
    }

    results.push({ name, methods, description });
  }
  return results;
}

function parseTypeExports(source: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  TYPE_EXPORT_RE.lastIndex = 0;
  while ((match = TYPE_EXPORT_RE.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/* ------------------------------------------------------------------ */
/*  DocGenerator                                                       */
/* ------------------------------------------------------------------ */

export class DocGenerator {
  constructor(private options: DocGeneratorOptions) {}

  /* ---- public API ------------------------------------------------ */

  async generate(): Promise<DocPage[]> {
    const [ports, adapters] = await Promise.all([
      this.scanPorts(),
      this.scanAdapters(),
    ]);

    const pages: DocPage[] = [];

    for (const port of ports) {
      pages.push({
        path: `api/ports/${port.name}.md`,
        title: portTitle(port.name),
        content: this.renderPort(port),
        category: port.category,
      });
    }

    for (const adapter of adapters) {
      pages.push({
        path: `api/adapters/${adapter.name}.md`,
        title: adapterTitle(adapter.name),
        content: this.renderAdapter(adapter),
        category: adapter.category,
      });
    }

    pages.push({
      path: "index.md",
      title: this.options.title ?? "Gauss Framework",
      content: this.renderIndex(ports, adapters),
      category: "Root",
    });

    // Write files
    for (const page of pages) {
      const dest = join(this.options.outputDir, page.path);
      await mkdir(join(dest, ".."), { recursive: true });
      await writeFile(dest, page.content, "utf-8");
    }

    return pages;
  }

  async scanPorts(): Promise<PortDoc[]> {
    const portsDir = join(this.options.srcDir, "ports");
    const entries = await readdir(portsDir);
    const portFiles = entries.filter((e) => e.endsWith(".port.ts"));
    const docs: PortDoc[] = [];

    for (const file of portFiles) {
      const source = await readFile(join(portsDir, file), "utf-8");
      const name = basename(file, ".port.ts");
      const interfaces = parseInterfaces(source);
      const types = parseTypeExports(source);
      const mainIface = interfaces.find((i) =>
        i.name.toLowerCase().includes("port"),
      );

      docs.push({
        name,
        fileName: file,
        interfaces,
        types,
        description: mainIface?.description ?? "",
        category: categoryFor(name),
      });
    }

    return docs.sort((a, b) => a.name.localeCompare(b.name));
  }

  async scanAdapters(): Promise<AdapterDoc[]> {
    const adaptersDir = join(this.options.srcDir, "adapters");
    const entries = await readdir(adaptersDir, { withFileTypes: true });
    const docs: AdapterDoc[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = join(adaptersDir, entry.name);
      const files = await readdir(dirPath, { recursive: true });
      const implementations = files
        .filter(
          (f) =>
            typeof f === "string" &&
            f.endsWith(".adapter.ts") &&
            !f.includes("__tests__"),
        )
        .map((f) => {
          const base = basename(f as string, ".adapter.ts");
          return adapterClassName(base);
        });

      docs.push({
        name: entry.name,
        dirName: entry.name,
        implementations,
        portName: `${pascalCase(entry.name)}Port`,
        category: categoryFor(entry.name),
      });
    }

    return docs.sort((a, b) => a.name.localeCompare(b.name));
  }

  /* ---- renderers ------------------------------------------------- */

  renderPort(port: PortDoc): string {
    const lines: string[] = [];
    lines.push(`# ${portTitle(port.name)}`);
    lines.push("");
    if (port.description) {
      lines.push(port.description);
      lines.push("");
    }
    lines.push(`**Category:** ${port.category}  `);
    lines.push(`**File:** \`src/ports/${port.fileName}\``);
    lines.push("");

    for (const iface of port.interfaces) {
      lines.push(`## \`${iface.name}\``);
      lines.push("");
      if (iface.description) {
        lines.push(iface.description);
        lines.push("");
      }

      if (iface.methods.length > 0) {
        lines.push("| Method | Signature | Description |");
        lines.push("|--------|-----------|-------------|");
        for (const m of iface.methods) {
          const sig = `\`${m.signature}\``;
          lines.push(`| ${m.name} | ${sig} | ${m.description || "—"} |`);
        }
        lines.push("");
      }
    }

    if (port.types.length > 0) {
      lines.push("## Exported Types");
      lines.push("");
      for (const t of port.types) {
        lines.push(`- \`${t}\``);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push(
      `[Back to API Reference](${this.baseUrl("/api/ports")})`,
    );
    lines.push("");
    return lines.join("\n");
  }

  renderAdapter(adapter: AdapterDoc): string {
    const lines: string[] = [];
    lines.push(`# ${adapterTitle(adapter.name)}`);
    lines.push("");
    lines.push(`**Category:** ${adapter.category}  `);
    lines.push(`**Port:** \`${adapter.portName}\`  `);
    lines.push(`**Directory:** \`src/adapters/${adapter.dirName}/\``);
    lines.push("");

    if (adapter.implementations.length > 0) {
      lines.push("## Implementations");
      lines.push("");
      for (const impl of adapter.implementations) {
        lines.push(`- \`${impl}\``);
      }
      lines.push("");
    } else {
      lines.push("_No adapter files found._");
      lines.push("");
    }

    lines.push("## Usage");
    lines.push("");
    lines.push("```typescript");
    const first =
      adapter.implementations[0] ?? `${pascalCase(adapter.name)}Adapter`;
    lines.push(
      `import { ${first} } from "@giulio-leone/gauss";`,
    );
    lines.push("");
    lines.push(
      `const adapter = new ${first}(/* options */);`,
    );
    lines.push("```");
    lines.push("");

    lines.push("---");
    lines.push("");
    lines.push(
      `[Back to Adapters](${this.baseUrl("/api/adapters")})`,
    );
    lines.push("");
    return lines.join("\n");
  }

  renderIndex(ports: PortDoc[], adapters: AdapterDoc[]): string {
    const title = this.options.title ?? "Gauss Framework";
    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(
      "The most comprehensive agentic AI framework — hexagonal architecture, multi-runtime, plugin system, and multi-agent collaboration.",
    );
    lines.push("");

    // Ports summary by category
    const portsByCategory = groupBy(ports, (p) => p.category);
    lines.push("## Port Interfaces");
    lines.push("");
    for (const [cat, items] of Object.entries(portsByCategory).sort()) {
      lines.push(`### ${cat}`);
      lines.push("");
      for (const p of items) {
        lines.push(
          `- [${portTitle(p.name)}](${this.baseUrl(`/api/ports/${p.name}`)})`,
        );
      }
      lines.push("");
    }

    // Adapters summary by category
    const adaptersByCategory = groupBy(adapters, (a) => a.category);
    lines.push("## Adapter Implementations");
    lines.push("");
    for (const [cat, items] of Object.entries(adaptersByCategory).sort()) {
      lines.push(`### ${cat}`);
      lines.push("");
      for (const a of items) {
        lines.push(
          `- [${adapterTitle(a.name)}](${this.baseUrl(`/api/adapters/${a.name}`)}) — ${a.implementations.length} implementation(s)`,
        );
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /* ---- helpers --------------------------------------------------- */

  private baseUrl(path: string): string {
    const base = this.options.baseUrl ?? "";
    return `${base}${path}`;
  }
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function pascalCase(s: string): string {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function portTitle(name: string): string {
  return `${pascalCase(name)} Port`;
}

function adapterTitle(name: string): string {
  return `${pascalCase(name)} Adapters`;
}

function adapterClassName(base: string): string {
  return `${pascalCase(base)}Adapter`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (map[k] ??= []).push(item);
  }
  return map;
}
