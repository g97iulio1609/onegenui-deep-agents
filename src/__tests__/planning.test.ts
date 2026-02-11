import { describe, it, expect, beforeEach } from "vitest";
import { VirtualFilesystem } from "../adapters/filesystem/virtual-fs.adapter.js";
import { createPlanningTools } from "../tools/planning/index.js";
import { createAllTodosDoneCondition } from "../agent/stop-conditions.js";

const ctx = {
  toolCallId: "test",
  messages: [] as never[],
  abortSignal: new AbortController().signal,
};

describe("Planning Tools", () => {
  let vfs: VirtualFilesystem;
  let tools: ReturnType<typeof createPlanningTools>;

  beforeEach(() => {
    vfs = new VirtualFilesystem();
    tools = createPlanningTools(vfs);
  });

  it("creates write_todos and review_todos tools", () => {
    expect(tools).toHaveProperty("write_todos");
    expect(tools).toHaveProperty("review_todos");
  });

  it("write_todos creates new todos", async () => {
    const result = await tools.write_todos.execute!(
      {
        todos: [
          { id: "task-1", title: "First task" },
          { id: "task-2", title: "Second task", status: "in_progress" },
        ],
      },
      ctx,
    );
    expect(result).toContain("2 created");
    expect(result).toContain("2 total");

    const stored = await vfs.read("todos.json", "persistent");
    const parsed = JSON.parse(stored);
    expect(parsed).toHaveLength(2);
  });

  it("write_todos merges with existing todos", async () => {
    await tools.write_todos.execute!(
      { todos: [{ id: "t1", title: "Original" }] },
      ctx,
    );
    await tools.write_todos.execute!(
      { todos: [{ id: "t1", title: "Updated" }, { id: "t2", title: "New" }] },
      ctx,
    );

    const stored = JSON.parse(await vfs.read("todos.json", "persistent"));
    expect(stored).toHaveLength(2);
    const t1 = stored.find((t: { id: string }) => t.id === "t1");
    expect(t1.title).toBe("Updated");
  });

  it("review_todos shows plan summary", async () => {
    await tools.write_todos.execute!(
      {
        todos: [
          { id: "a", title: "A", status: "done" },
          { id: "b", title: "B", status: "pending" },
          { id: "c", title: "C", status: "in_progress" },
        ],
      },
      ctx,
    );

    const result = await tools.review_todos.execute!({}, ctx);
    expect(result).toContain("3");
    expect(result).toContain("done");
    expect(result).toContain("pending");
  });

  it("review_todos updates statuses", async () => {
    await tools.write_todos.execute!(
      { todos: [{ id: "x", title: "X", status: "pending" }] },
      ctx,
    );

    await tools.review_todos.execute!(
      { updates: [{ id: "x", status: "done" }] },
      ctx,
    );

    const stored = JSON.parse(await vfs.read("todos.json", "persistent"));
    expect(stored[0].status).toBe("done");
  });
});

describe("allTodosDone stop condition", () => {
  it("returns false when no todos exist", async () => {
    const vfs = new VirtualFilesystem();
    const check = createAllTodosDoneCondition(vfs);
    expect(await check()).toBe(false);
  });

  it("returns false when todos are pending", async () => {
    const vfs = new VirtualFilesystem();
    await vfs.write(
      "todos.json",
      JSON.stringify([{ id: "a", status: "pending" }]),
      "persistent",
    );
    const check = createAllTodosDoneCondition(vfs);
    expect(await check()).toBe(false);
  });

  it("returns true when all todos are done", async () => {
    const vfs = new VirtualFilesystem();
    await vfs.write(
      "todos.json",
      JSON.stringify([
        { id: "a", status: "done" },
        { id: "b", status: "done" },
      ]),
      "persistent",
    );
    const check = createAllTodosDoneCondition(vfs);
    expect(await check()).toBe(true);
  });
});
