# Workflows Guide

## Overview

Gauss provides a workflow DSL for defining multi-step execution pipelines and a graph execution engine for multi-agent coordination.

## Workflow DSL

### Defining a Workflow

```typescript
import { defineWorkflow, WorkflowBuilder } from "@giulio-leone/gauss/workflow";

const workflow = defineWorkflow({
  name: "content-pipeline",
  steps: [
    {
      id: "research",
      execute: async (ctx) => {
        const data = await ctx.agent.run(`Research: ${ctx.input.topic}`);
        return { research: data.text };
      },
    },
    {
      id: "draft",
      dependsOn: ["research"],
      execute: async (ctx) => {
        const draft = await ctx.agent.run(
          `Write a draft based on: ${ctx.results.research}`
        );
        return { draft: draft.text };
      },
    },
    {
      id: "review",
      dependsOn: ["draft"],
      execute: async (ctx) => {
        const reviewed = await ctx.agent.run(
          `Review and improve: ${ctx.results.draft}`
        );
        return { final: reviewed.text };
      },
    },
  ],
});
```

### Running a Workflow

```typescript
const result = await workflow.execute({
  input: { topic: "AI Safety" },
  agent: myAgent,
});

console.log(result.final);
```

### Workflow Context

Each step receives a `WorkflowContext` with:

| Property | Type | Description |
|----------|------|-------------|
| `input` | `Record<string, unknown>` | Original workflow input |
| `results` | `Record<string, unknown>` | Accumulated results from previous steps |
| `agent` | `Agent` | Agent instance for LLM calls |
| `metadata` | `Record<string, unknown>` | Workflow-level metadata |

### Workflow Events

Subscribe to workflow lifecycle events:

```typescript
workflow.on("step:start", ({ stepId }) => {
  console.log(`Starting step: ${stepId}`);
});

workflow.on("step:complete", ({ stepId, result }) => {
  console.log(`Completed step: ${stepId}`);
});

workflow.on("step:error", ({ stepId, error }) => {
  console.error(`Failed step: ${stepId}`, error);
});
```

## Graph Execution

For complex multi-agent topologies, use the graph engine.

### Agent Graph

```typescript
import { AgentGraphBuilder, GraphExecutor } from "@giulio-leone/gauss";

const graph = new AgentGraphBuilder()
  .addNode("planner", plannerAgent)
  .addNode("researcher", researchAgent)
  .addNode("writer", writerAgent)
  .addNode("reviewer", reviewerAgent)
  .addEdge("planner", "researcher")
  .addEdge("planner", "writer")
  .addEdge("researcher", "reviewer")
  .addEdge("writer", "reviewer")
  .build();

const executor = new GraphExecutor(graph);
const result = await executor.execute({
  task: "Write a technical report on quantum computing",
});
```

### Supervisor

The `AgentSupervisor` manages fault tolerance:

```typescript
import { AgentSupervisor } from "@giulio-leone/gauss";

const supervisor = new AgentSupervisor({
  restartPolicy: "on-failure",
  maxRestarts: 3,
  backoff: "exponential",
});
```

### Team Builder

Coordinate a team of agents with shared context:

```typescript
import { TeamBuilder } from "@giulio-leone/gauss";

const team = new TeamBuilder()
  .addMember("analyst", analystAgent, { role: "data analysis" })
  .addMember("designer", designerAgent, { role: "UI design" })
  .addMember("developer", devAgent, { role: "implementation" })
  .withSupervisor(supervisorAgent)
  .build();

const result = await team.execute("Build a dashboard for sales data");
```

### Worker Pool

Parallel execution with resource constraints:

```typescript
import { WorkerPool } from "@giulio-leone/gauss";

const pool = new WorkerPool({
  maxConcurrency: 4,
  tokenBudget: 100_000,
});

const results = await pool.map(tasks, async (task, worker) => {
  return worker.agent.run(task.prompt);
});
```

### Dynamic Graphs

Modify graph topology at runtime:

```typescript
import { DynamicAgentGraph } from "@giulio-leone/gauss";

const graph = new DynamicAgentGraph();
graph.addNode("analyzer", analyzerAgent);

// Add nodes dynamically based on analysis results
const analysis = await graph.executeNode("analyzer", input);
if (analysis.needsResearch) {
  graph.addNode("researcher", researchAgent);
  graph.addEdge("analyzer", "researcher");
}
```

## Related

- [Agents Guide](./agents.md) — agent creation and configuration
- [Middleware Guide](./middleware.md) — middleware for workflow steps
- [Architecture](../architecture.md) — graph engine architecture
