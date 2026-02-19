// =============================================================================
// Tests per il sistema di planning strutturato
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { VirtualFilesystem } from "../adapters/filesystem/virtual-fs.adapter.js";
import {
  createPlanCreateTool,
  createPlanUpdateTool,
  createPlanStatusTool,
  createPlanVisualizeTool,
} from "../tools/planning/index.js";
import {
  PlanSchema,
  createPlan,
  createPhase,
  createStep,
  createSubStep,
  createExamplePlan,
  validatePlan,
  calculateProgress,
  isValidStepTransition,
  isValidPlanTransition,
  transitionStep,
  todosToplan,
} from "../domain/plan.schema.js";
import type { Todo } from "../domain/todo.schema.js";

// Utility: tool execution context
const ctx = { toolCallId: "test-call", messages: [], abortSignal: new AbortController().signal };

describe("Plan Schema", () => {
  it("validates a well-formed plan", () => {
    const plan = createExamplePlan();
    const result = PlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("createStep applies defaults", () => {
    const step = createStep({ id: "test-step", title: "Test" });
    expect(step.status).toBe("idle");
    expect(step.priority).toBe("medium");
    expect(step.executionMode).toBe("sequential");
    expect(step.dependencies).toEqual([]);
    expect(step.subSteps).toEqual([]);
    expect(step.contract).toEqual({ inputs: [], outputs: [] });
  });

  it("createPhase applies defaults", () => {
    const phase = createPhase({
      id: "test-phase",
      title: "Test Phase",
      steps: [createStep({ id: "s1", title: "S1" })],
    });
    expect(phase.executionMode).toBe("sequential");
    expect(phase.status).toBe("idle");
    expect(phase.dependencies).toEqual([]);
  });

  it("createSubStep supports nesting", () => {
    const ss = createSubStep({
      id: "sub-1",
      title: "Sub 1",
      children: [createSubStep({ id: "sub-1-1", title: "Sub 1.1" })],
    });
    expect(ss.children).toHaveLength(1);
    expect(ss.children![0]!.id).toBe("sub-1-1");
  });
});

describe("Plan Validation", () => {
  it("detects duplicate step IDs", () => {
    const plan = createPlan({
      id: "dup-test",
      title: "Dup Test",
      metadata: { goal: "test", constraints: [] },
      phases: [
        createPhase({
          id: "p1",
          title: "P1",
          steps: [
            createStep({ id: "same-id", title: "S1" }),
            createStep({ id: "same-id", title: "S2" }),
          ],
        }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicato"))).toBe(true);
  });

  it("detects missing dependency references", () => {
    const plan = createPlan({
      id: "dep-test",
      title: "Dep Test",
      metadata: { goal: "test", constraints: [] },
      phases: [
        createPhase({
          id: "p1",
          title: "P1",
          steps: [
            createStep({
              id: "s1",
              title: "S1",
              dependencies: ["nonexistent"],
            }),
          ],
        }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("inesistente"))).toBe(true);
  });

  it("detects self-dependency", () => {
    const plan = createPlan({
      id: "self-dep",
      title: "Self Dep",
      metadata: { goal: "test", constraints: [] },
      phases: [
        createPhase({
          id: "p1",
          title: "P1",
          steps: [
            createStep({ id: "s1", title: "S1", dependencies: ["s1"] }),
          ],
        }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
  });

  it("validates example plan successfully", () => {
    const plan = createExamplePlan();
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("State Machine", () => {
  it("allows valid transitions", () => {
    expect(isValidStepTransition("idle", "pending")).toBe(true);
    expect(isValidStepTransition("pending", "running")).toBe(true);
    expect(isValidStepTransition("running", "completed")).toBe(true);
    expect(isValidStepTransition("failed", "pending")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(isValidStepTransition("idle", "completed")).toBe(false);
    expect(isValidStepTransition("completed", "running")).toBe(false);
    expect(isValidStepTransition("cancelled", "running")).toBe(false);
  });

  it("transitionStep applies correctly", () => {
    const step = createStep({ id: "ts1", title: "Test" });
    const pending = transitionStep(step, "pending");
    expect(pending.status).toBe("pending");

    const running = transitionStep(pending, "running");
    expect(running.status).toBe("running");
    expect(running.startedAt).toBeDefined();

    const completed = transitionStep(running, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeDefined();
  });

  it("transitionStep throws on invalid", () => {
    const step = createStep({ id: "ts2", title: "Test" });
    expect(() => transitionStep(step, "completed")).toThrow("non valida");
  });

  it("validates plan transitions", () => {
    expect(isValidPlanTransition("draft", "active")).toBe(true);
    expect(isValidPlanTransition("active", "completed")).toBe(true);
    expect(isValidPlanTransition("completed", "active")).toBe(false);
  });
});

describe("Progress Calculator", () => {
  it("computes progress for example plan", () => {
    const plan = createExamplePlan();
    const progress = calculateProgress(plan);
    expect(progress.totalSteps).toBeGreaterThan(0);
    expect(progress.completedSteps).toBe(0);
    expect(progress.progress).toBe(0);
    expect(progress.phases.length).toBe(plan.phases.length);
  });

  it("computes correct percentage", () => {
    const plan = createPlan({
      id: "prog-test",
      title: "Progress Test",
      metadata: { goal: "test", constraints: [] },
      phases: [
        createPhase({
          id: "p1",
          title: "P1",
          steps: [
            createStep({ id: "s1", title: "S1", status: "completed" as any }),
            createStep({ id: "s2", title: "S2" }),
          ],
        }),
      ],
    });
    const progress = calculateProgress(plan);
    expect(progress.progress).toBe(0.5);
    expect(progress.completedSteps).toBe(1);
  });
});

describe("Todo Migration", () => {
  it("converts legacy todos to plan", () => {
    const todos: Todo[] = [
      {
        id: "task-1",
        title: "First task",
        description: "Do something",
        status: "done",
        dependencies: [],
        priority: "high",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: Date.now(),
      },
      {
        id: "task-2",
        title: "Second task",
        status: "pending",
        dependencies: ["task-1"],
        priority: "medium",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const plan = todosToplan(todos, "Migrated Plan");
    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0]!.steps).toHaveLength(2);
    expect(plan.phases[0]!.steps[0]!.status).toBe("completed");
    expect(plan.phases[0]!.steps[1]!.status).toBe("pending");
    expect(plan.metadata.tags).toContain("migrated-from-todos");
  });
});

describe("Plan Tools", () => {
  let vfs: VirtualFilesystem;

  beforeEach(() => {
    vfs = new VirtualFilesystem();
  });

  it("plan_create creates a structured plan", async () => {
    const tool = createPlanCreateTool(vfs);
    const result = await tool.execute!(
      {
        id: "test-plan",
        title: "Test Plan",
        goal: "Test the plan system",
        phases: [
          {
            id: "phase-1",
            title: "Phase One",
            steps: [
              {
                id: "step-1",
                title: "Step One",
                prompt: "Do the first thing",
                outputs: [
                  { name: "result", type: "string" as const, required: true },
                ],
              },
              {
                id: "step-2",
                title: "Step Two",
                dependencies: ["step-1"],
                inputs: [
                  { name: "result", type: "string" as const, required: true },
                ],
              },
            ],
          },
        ],
      },
      ctx,
    );

    expect(result).toContain("creato con successo");
    expect(result).toContain("test-plan");

    // Verify persisted
    const raw = await vfs.read("plan.json", "persistent");
    const plan = JSON.parse(raw);
    expect(plan.id).toBe("test-plan");
    expect(plan.phases[0].steps).toHaveLength(2);
  });

  it("plan_update updates step status", async () => {
    const createTool = createPlanCreateTool(vfs);
    await createTool.execute!(
      {
        id: "upd-plan",
        title: "Update Plan",
        goal: "Test updates",
        phases: [
          {
            id: "p1",
            title: "P1",
            steps: [{ id: "s1", title: "S1" }],
          },
        ],
      },
      ctx,
    );

    const updateTool = createPlanUpdateTool(vfs);

    // Transition idle → pending
    let result = await updateTool.execute!(
      { action: "update_step", stepId: "s1", status: "pending" },
      ctx,
    );
    expect(result).toContain("aggiornato");

    // Transition pending → running
    result = await updateTool.execute!(
      { action: "update_step", stepId: "s1", status: "running" },
      ctx,
    );
    expect(result).toContain("aggiornato");

    // Invalid transition running → idle
    result = await updateTool.execute!(
      { action: "update_step", stepId: "s1", status: "idle" },
      ctx,
    );
    expect(result).toContain("non valida");
  });

  it("plan_update adds step to phase", async () => {
    const createTool = createPlanCreateTool(vfs);
    await createTool.execute!(
      {
        id: "add-plan",
        title: "Add Plan",
        goal: "Test adding steps",
        phases: [
          {
            id: "p1",
            title: "P1",
            steps: [{ id: "s1", title: "S1" }],
          },
        ],
      },
      ctx,
    );

    const updateTool = createPlanUpdateTool(vfs);
    const result = await updateTool.execute!(
      {
        action: "add_step",
        phaseId: "p1",
        stepId: "s2",
        title: "New Step",
        prompt: "Do something new",
      },
      ctx,
    );
    expect(result).toContain("aggiunto");

    // Verify
    const raw = await vfs.read("plan.json", "persistent");
    const plan = JSON.parse(raw);
    expect(plan.phases[0].steps).toHaveLength(2);
  });

  it("plan_status shows progress tree", async () => {
    const createTool = createPlanCreateTool(vfs);
    await createTool.execute!(
      {
        id: "status-plan",
        title: "Status Plan",
        goal: "Test status",
        phases: [
          {
            id: "p1",
            title: "Phase One",
            steps: [
              { id: "s1", title: "Step One" },
              { id: "s2", title: "Step Two" },
            ],
          },
        ],
      },
      ctx,
    );

    const statusTool = createPlanStatusTool(vfs);
    const result = await statusTool.execute!({ verbose: false }, ctx);
    expect(result).toContain("Status Plan");
    expect(result).toContain("0%");
    expect(result).toContain("s1");
    expect(result).toContain("s2");
  });

  it("plan_visualize generates ASCII output", async () => {
    const createTool = createPlanCreateTool(vfs);
    await createTool.execute!(
      {
        id: "viz-plan",
        title: "Viz Plan",
        goal: "Test visualization",
        phases: [
          {
            id: "p1",
            title: "Phase One",
            steps: [{ id: "s1", title: "Step One" }],
          },
        ],
      },
      ctx,
    );

    const vizTool = createPlanVisualizeTool(vfs);
    const result = await vizTool.execute!({ format: "ascii" }, ctx);
    expect(result).toContain("Viz Plan");
    expect(result).toContain("s1");
  });

  it("plan_visualize generates Mermaid output", async () => {
    const createTool = createPlanCreateTool(vfs);
    await createTool.execute!(
      {
        id: "mermaid-plan",
        title: "Mermaid Plan",
        goal: "Test mermaid",
        phases: [
          {
            id: "p1",
            title: "Phase One",
            steps: [
              { id: "s1", title: "Step One" },
              { id: "s2", title: "Step Two", dependencies: ["s1"] },
            ],
          },
        ],
      },
      ctx,
    );

    const vizTool = createPlanVisualizeTool(vfs);
    const result = await vizTool.execute!({ format: "mermaid" }, ctx);
    expect(result).toContain("mermaid");
    expect(result).toContain("graph TD");
    expect(result).toContain("s1");
    expect(result).toContain("s2");
  });
});
