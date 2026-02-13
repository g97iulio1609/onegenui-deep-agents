import { describe, it, expect } from "vitest";

import { SharedContext } from "../shared-context.js";
import { VirtualFilesystem } from "../../adapters/filesystem/virtual-fs.adapter.js";

// =============================================================================
// Tests
// =============================================================================

describe("SharedContext", () => {
  it("set/get round-trip", async () => {
    const ctx = new SharedContext(new VirtualFilesystem());
    await ctx.set("key1", { hello: "world" });
    const value = await ctx.get<{ hello: string }>("key1");
    expect(value).toEqual({ hello: "world" });
  });

  it("get returns null for missing key", async () => {
    const ctx = new SharedContext(new VirtualFilesystem());
    const value = await ctx.get("nonexistent");
    expect(value).toBeNull();
  });

  it("delete removes key", async () => {
    const ctx = new SharedContext(new VirtualFilesystem());
    await ctx.set("key1", "value1");
    await ctx.delete("key1");
    const value = await ctx.get("key1");
    expect(value).toBeNull();
  });

  it("list returns all keys", async () => {
    const ctx = new SharedContext(new VirtualFilesystem());
    await ctx.set("alpha", 1);
    await ctx.set("beta", 2);
    const keys = await ctx.list();
    expect(keys.sort()).toEqual(["alpha", "beta"]);
  });

  it("setNodeResult / getNodeResult", async () => {
    const ctx = new SharedContext(new VirtualFilesystem());
    await ctx.setNodeResult("node-1", "some output");
    const result = await ctx.getNodeResult("node-1");
    expect(result).toBe("some output");
  });
});
