import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTaskTool, createSubagentTools } from "../tools/subagent/index.js";
import type { TaskToolConfig } from "../tools/subagent/index.js";

const ctx = {
  toolCallId: "test",
  messages: [] as never[],
  abortSignal: new AbortController().signal,
};

const mockModel = { modelId: "mock-model" } as TaskToolConfig["parentModel"];

const { generateFn, constructorSpy } = vi.hoisted(() => {
  const generateFn = vi.fn().mockResolvedValue({ text: "Subagent result" });
  const constructorSpy = vi.fn();
  return { generateFn, constructorSpy };
});

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  class MockToolLoopAgent {
    constructor(settings: Record<string, unknown>) {
      constructorSpy(settings);
    }
    generate = generateFn;
  }

  return { ...actual, ToolLoopAgent: MockToolLoopAgent };
});

describe("Subagent Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateFn.mockResolvedValue({ text: "Subagent result" });
  });

  it("createSubagentTools returns a task tool", () => {
    const tools = createSubagentTools({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
    });
    expect(tools).toHaveProperty("task");
    expect(tools.task).toHaveProperty("execute");
  });

  it("returns depth error when currentDepth >= maxDepth", async () => {
    const taskTool = createTaskTool({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
      maxDepth: 2,
      currentDepth: 2,
    });

    const result = await taskTool.execute!(
      { prompt: "do something" },
      ctx,
    );

    expect(result).toContain("Maximum subagent depth");
    expect(result).toContain("2");
  });

  it("returns depth error when currentDepth exceeds maxDepth", async () => {
    const taskTool = createTaskTool({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
      maxDepth: 1,
      currentDepth: 5,
    });

    const result = await taskTool.execute!(
      { prompt: "do something" },
      ctx,
    );

    expect(result).toContain("[Error]");
    expect(result).toContain("Maximum subagent depth");
  });

  it("creates a ToolLoopAgent and returns its text result", async () => {
    const taskTool = createTaskTool({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
      maxDepth: 3,
      currentDepth: 0,
    });

    const result = await taskTool.execute!(
      { prompt: "analyze this" },
      ctx,
    );

    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe("Subagent result");
  });

  it("passes custom instructions to ToolLoopAgent", async () => {
    const taskTool = createTaskTool({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
    });

    await taskTool.execute!(
      { prompt: "task", instructions: "Be concise." },
      ctx,
    );

    expect(constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: "Be concise." }),
    );
  });

  it("returns error message on agent failure", async () => {
    generateFn.mockRejectedValueOnce(new Error("LLM crashed"));

    const taskTool = createTaskTool({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
    });

    const result = await taskTool.execute!(
      { prompt: "will fail" },
      ctx,
    );

    expect(result).toContain("[Error]");
    expect(result).toContain("LLM crashed");
  });

  it("returns timeout error when subagent exceeds timeout", async () => {
    generateFn.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    const taskTool = createTaskTool({
      parentModel: mockModel,
      parentFilesystem: {} as TaskToolConfig["parentFilesystem"],
      timeoutMs: 50,
    });

    const result = await taskTool.execute!(
      { prompt: "slow task" },
      ctx,
    );

    expect(result).toContain("[Error]");
    expect(result).toContain("timed out");
  });
});
