import { describe, it, expect, beforeEach } from "vitest";
import { VirtualFilesystem } from "../adapters/filesystem/virtual-fs.adapter.js";
import { createFilesystemTools } from "../tools/filesystem/index.js";

describe("VirtualFilesystem", () => {
  let vfs: VirtualFilesystem;

  beforeEach(() => {
    vfs = new VirtualFilesystem();
  });

  it("writes and reads files", async () => {
    await vfs.write("test.txt", "hello world");
    const content = await vfs.read("test.txt");
    expect(content).toBe("hello world");
  });

  it("checks file existence", async () => {
    expect(await vfs.exists("missing.txt")).toBe(false);
    await vfs.write("exists.txt", "content");
    expect(await vfs.exists("exists.txt")).toBe(true);
  });

  it("lists directory entries", async () => {
    await vfs.write("dir/a.txt", "a");
    await vfs.write("dir/b.txt", "b");
    const entries = await vfs.list("dir");
    expect(entries.map((e) => e.name).sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("deletes files", async () => {
    await vfs.write("del.txt", "content");
    await vfs.delete("del.txt");
    expect(await vfs.exists("del.txt")).toBe(false);
  });

  it("handles zones independently", async () => {
    await vfs.write("data.txt", "transient", "transient");
    await vfs.write("data.txt", "persistent", "persistent");
    expect(await vfs.read("data.txt", "transient")).toBe("transient");
    expect(await vfs.read("data.txt", "persistent")).toBe("persistent");
  });

  it("globs files", async () => {
    await vfs.write("src/a.ts", "a");
    await vfs.write("src/b.ts", "b");
    await vfs.write("src/c.js", "c");
    const matches = await vfs.glob("**/*.ts");
    expect(matches.sort()).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("searches file contents", async () => {
    await vfs.write("file1.txt", "hello world\nfoo bar");
    await vfs.write("file2.txt", "goodbye world");
    const results = await vfs.search("world");
    expect(results.length).toBe(2);
    expect(results[0]!.lineContent).toContain("world");
  });

  it("gets file stats", async () => {
    await vfs.write("stat.txt", "hello");
    const stat = await vfs.stat("stat.txt");
    expect(stat.isFile).toBe(true);
    expect(stat.isDirectory).toBe(false);
    expect(stat.size).toBe(5);
  });

  it("clears transient zone", async () => {
    await vfs.write("tmp.txt", "data", "transient");
    await vfs.write("keep.txt", "data", "persistent");
    await vfs.clearTransient();
    expect(await vfs.exists("tmp.txt", "transient")).toBe(false);
    expect(await vfs.exists("keep.txt", "persistent")).toBe(true);
  });
});

describe("Filesystem Tools", () => {
  let vfs: VirtualFilesystem;
  let tools: ReturnType<typeof createFilesystemTools>;

  beforeEach(() => {
    vfs = new VirtualFilesystem();
    tools = createFilesystemTools(vfs);
  });

  it("creates all 6 tools", () => {
    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining([
        "ls",
        "read_file",
        "write_file",
        "edit_file",
        "glob",
        "grep",
      ]),
    );
  });

  it("write_file and read_file round-trip", async () => {
    const ctx = { toolCallId: "1", messages: [] as never[], abortSignal: new AbortController().signal };
    await tools.write_file.execute!({ path: "test.txt", content: "hello" }, ctx);
    const result = await tools.read_file.execute!({ path: "test.txt" }, ctx);
    expect(result).toContain("hello");
  });

  it("edit_file replaces content", async () => {
    const ctx = { toolCallId: "3", messages: [] as never[], abortSignal: new AbortController().signal };
    await vfs.write("edit.txt", "foo bar baz");
    const result = await tools.edit_file.execute!({ path: "edit.txt", oldStr: "bar", newStr: "qux" }, ctx);
    expect(result).toContain("edited");
    const content = await vfs.read("edit.txt");
    expect(content).toBe("foo qux baz");
  });
});
