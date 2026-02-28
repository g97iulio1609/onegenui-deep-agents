import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocGenerator } from "../doc-generator.js";
import type { PortDoc, AdapterDoc } from "../doc-generator.js";
import * as fs from "fs/promises";
import * as path from "path";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const FIXTURES_DIR = path.join(__dirname, "__fixtures__");
const OUTPUT_DIR = path.join(__dirname, "__output__");

const PORT_SOURCE = `
/** Storage port for vector embeddings. */
export interface VectorStorePort {
  /** Insert or update documents. */
  upsert(documents: VectorDocument[]): Promise<void>;
  /** Query by embedding similarity. */
  query(params: VectorSearchParams): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
}

export type VectorDocument = {
  id: string;
  embedding: number[];
};

export type VectorSearchParams = {
  embedding: number[];
  topK: number;
};
`;

const PORT_NO_TSDOC = `
export interface SimplePort {
  doSomething(input: string): Promise<string>;
}
`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function setupFixtures() {
  await fs.mkdir(path.join(FIXTURES_DIR, "ports"), { recursive: true });
  await fs.mkdir(path.join(FIXTURES_DIR, "adapters", "vector-store"), {
    recursive: true,
  });
  await fs.mkdir(
    path.join(FIXTURES_DIR, "adapters", "vector-store", "pinecone"),
    { recursive: true },
  );
  await fs.mkdir(path.join(FIXTURES_DIR, "adapters", "auth"), {
    recursive: true,
  });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await fs.writeFile(
    path.join(FIXTURES_DIR, "ports", "vector-store.port.ts"),
    PORT_SOURCE,
  );
  await fs.writeFile(
    path.join(FIXTURES_DIR, "ports", "simple.port.ts"),
    PORT_NO_TSDOC,
  );

  await fs.writeFile(
    path.join(FIXTURES_DIR, "adapters", "vector-store", "inmemory.adapter.ts"),
    "export class InmemoryAdapter {}",
  );
  await fs.writeFile(
    path.join(
      FIXTURES_DIR,
      "adapters",
      "vector-store",
      "pinecone",
      "pinecone-store.adapter.ts",
    ),
    "export class PineconeStoreAdapter {}",
  );
  await fs.writeFile(
    path.join(FIXTURES_DIR, "adapters", "auth", "jwt.adapter.ts"),
    "export class JwtAdapter {}",
  );
}

async function cleanFixtures() {
  await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("DocGenerator", () => {
  let gen: DocGenerator;

  beforeEach(async () => {
    await setupFixtures();
    gen = new DocGenerator({
      srcDir: FIXTURES_DIR,
      outputDir: OUTPUT_DIR,
      title: "Test Docs",
      baseUrl: "/test",
    });
  });

  afterEach(async () => {
    await cleanFixtures();
  });

  /* 1 */ it("scanPorts finds port files", async () => {
    const ports = await gen.scanPorts();
    const names = ports.map((p) => p.name);
    expect(names).toContain("vector-store");
    expect(names).toContain("simple");
    expect(ports.length).toBe(2);
  });

  /* 2 */ it("scanAdapters finds adapter directories", async () => {
    const adapters = await gen.scanAdapters();
    const names = adapters.map((a) => a.name);
    expect(names).toContain("vector-store");
    expect(names).toContain("auth");
    expect(adapters.length).toBe(2);
  });

  /* 3 */ it("renderPort generates valid Markdown with interfaces and methods", async () => {
    const ports = await gen.scanPorts();
    const vsPorts = ports.find((p) => p.name === "vector-store")!;
    const md = gen.renderPort(vsPorts);

    expect(md).toContain("# VectorStore Port");
    expect(md).toContain("## `VectorStorePort`");
    expect(md).toContain("Storage port for vector embeddings.");
    expect(md).toContain("| upsert |");
    expect(md).toContain("| query |");
    expect(md).toContain("| delete |");
    expect(md).toContain("## Exported Types");
    expect(md).toContain("`VectorDocument`");
  });

  /* 4 */ it("renderAdapter generates valid Markdown with implementations", async () => {
    const adapters = await gen.scanAdapters();
    const vs = adapters.find((a) => a.name === "vector-store")!;
    const md = gen.renderAdapter(vs);

    expect(md).toContain("# VectorStore Adapters");
    expect(md).toContain("## Implementations");
    expect(md).toContain("`InmemoryAdapter`");
    expect(md).toContain("`PineconeStoreAdapter`");
    expect(md).toContain("## Usage");
    expect(md).toContain("```typescript");
  });

  /* 5 */ it("renderIndex creates navigation structure with categories", async () => {
    const ports = await gen.scanPorts();
    const adapters = await gen.scanAdapters();
    const md = gen.renderIndex(ports, adapters);

    expect(md).toContain("# Test Docs");
    expect(md).toContain("## Port Interfaces");
    expect(md).toContain("## Adapter Implementations");
    expect(md).toContain("### Storage");
    expect(md).toContain("[VectorStore Port]");
    expect(md).toContain("[VectorStore Adapters]");
    expect(md).toContain("implementation(s)");
  });

  /* 6 */ it("generate creates all pages and writes to disk", async () => {
    const pages = await gen.generate();

    expect(pages.length).toBeGreaterThanOrEqual(5);
    // Index + 2 ports + 2 adapters = 5 minimum

    const indexPage = pages.find((p) => p.path === "index.md");
    expect(indexPage).toBeDefined();
    expect(indexPage!.title).toBe("Test Docs");

    // Check files exist on disk
    const indexFile = await fs.readFile(
      path.join(OUTPUT_DIR, "index.md"),
      "utf-8",
    );
    expect(indexFile).toContain("# Test Docs");
  });

  /* 7 */ it("handles missing TSDoc gracefully", async () => {
    const ports = await gen.scanPorts();
    const simple = ports.find((p) => p.name === "simple")!;
    const md = gen.renderPort(simple);

    expect(md).toContain("# Simple Port");
    expect(md).toContain("## `SimplePort`");
    expect(md).toContain("| doSomething |");
    // No crash, description is empty
    expect(simple.description).toBe("");
  });

  /* 8 */ it("categories are correctly assigned", async () => {
    const ports = await gen.scanPorts();
    const adapters = await gen.scanAdapters();

    const vs = ports.find((p) => p.name === "vector-store")!;
    expect(vs.category).toBe("Storage");

    const auth = adapters.find((a) => a.name === "auth")!;
    expect(auth.category).toBe("Security");

    // Unknown category falls back to "Other"
    const simple = ports.find((p) => p.name === "simple")!;
    expect(simple.category).toBe("Other");
  });
});
