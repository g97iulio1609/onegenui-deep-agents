import { describe, it, expect } from "vitest";
import { AgentSpec, SkillSpec, discoverAgents } from "../spec.js";

// ─── AgentSpec ─────────────────────────────────────────────────────

describe("AgentSpec", () => {
  const sampleMd = `# My Agent

## Description
A helpful coding assistant.

## Model
gpt-4o

## Provider
openai

## Instructions
You are a coding assistant that helps with TypeScript.
Always provide examples.

## Tools
### code_review
Reviews code for quality.
\`\`\`json
{"language": "string"}
\`\`\`

### test_runner
Runs unit tests.

## Skills
- typescript-expert
- code-review

## Capabilities
- code-generation
- refactoring
- testing

## Environment
- NODE_ENV=production
- LOG_LEVEL=debug
`;

  it("parses a complete AGENTS.MD", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    expect(spec.name).toBe("My Agent");
    expect(spec.description).toContain("coding assistant");
    expect(spec.model).toBe("gpt-4o");
    expect(spec.provider).toBe("openai");
    expect(spec.instructions).toContain("TypeScript");
  });

  it("parses tools with parameters", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    expect(spec.tools).toHaveLength(2);
    expect(spec.tools[0].name).toBe("code_review");
    expect(spec.tools[0].parameters).toBeDefined();
    expect(spec.tools[1].name).toBe("test_runner");
  });

  it("parses skills and capabilities", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    expect(spec.skills).toContain("typescript-expert");
    expect(spec.skills).toContain("code-review");
    expect(spec.capabilities).toContain("code-generation");
    expect(spec.capabilities).toContain("refactoring");
  });

  it("parses environment variables", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    expect(spec.environment.get("NODE_ENV")).toBe("production");
    expect(spec.environment.get("LOG_LEVEL")).toBe("debug");
  });

  it("hasTool checks correctly", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    expect(spec.hasTool("code_review")).toBe(true);
    expect(spec.hasTool("nonexistent")).toBe(false);
  });

  it("hasCapability checks correctly", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    expect(spec.hasCapability("testing")).toBe(true);
    expect(spec.hasCapability("nonexistent")).toBe(false);
  });

  it("toJSON produces serializable output", () => {
    const spec = AgentSpec.fromMarkdown(sampleMd);
    const json = spec.toJSON();
    expect(json.name).toBe("My Agent");
    expect(json.tools).toHaveLength(2);
    expect(Array.isArray(json.environment)).toBe(true);
  });

  it("handles minimal AGENTS.MD", () => {
    const minimal = `# Minimal Agent\n\n## Description\nA simple agent.`;
    const spec = AgentSpec.fromMarkdown(minimal);
    expect(spec.name).toBe("Minimal Agent");
    expect(spec.tools).toHaveLength(0);
    expect(spec.skills).toHaveLength(0);
  });

  it("handles YAML frontmatter", () => {
    const withFrontmatter = `---
version: "1.0"
author: test
---
# Frontmatter Agent

## Description
An agent with frontmatter.
`;
    const spec = AgentSpec.fromMarkdown(withFrontmatter);
    expect(spec.name).toBe("Frontmatter Agent");
    expect(spec.metadata).toBeDefined();
  });
});

// ─── SkillSpec ─────────────────────────────────────────────────────

describe("SkillSpec", () => {
  const sampleSkillMd = `# Code Review

## Description
Reviews code for quality, correctness, and best practices.

## Steps
1. Read the code carefully
   Action: analyze_code
2. Check for common patterns
   Action: check_patterns
3. Provide feedback

## Inputs
- code (string): The code to review
- language (string, optional): The programming language

## Outputs
- feedback (string): Review feedback
- score (number, optional): Quality score 0-100
`;

  it("parses a complete SKILL.MD", () => {
    const skill = SkillSpec.fromMarkdown(sampleSkillMd);
    expect(skill.name).toBe("Code Review");
    expect(skill.description).toContain("quality");
  });

  it("parses steps with actions", () => {
    const skill = SkillSpec.fromMarkdown(sampleSkillMd);
    expect(skill.steps).toHaveLength(3);
    expect(skill.steps[0].action).toBe("analyze_code");
    expect(skill.steps[2].action).toBeNull();
  });

  it("parses inputs and outputs", () => {
    const skill = SkillSpec.fromMarkdown(sampleSkillMd);
    expect(skill.inputs).toHaveLength(2);
    expect(skill.outputs).toHaveLength(2);
    expect(skill.inputs[0].name).toBe("code");
    expect(skill.inputs[0].required).toBe(true);
    expect(skill.inputs[1].required).toBe(false);
  });

  it("stepCount returns correct count", () => {
    const skill = SkillSpec.fromMarkdown(sampleSkillMd);
    expect(skill.stepCount).toBe(3);
  });

  it("requiredInputs filters correctly", () => {
    const skill = SkillSpec.fromMarkdown(sampleSkillMd);
    expect(skill.requiredInputs).toHaveLength(1);
    expect(skill.requiredInputs[0].name).toBe("code");
  });

  it("toJSON produces serializable output", () => {
    const skill = SkillSpec.fromMarkdown(sampleSkillMd);
    const json = skill.toJSON();
    expect(json.name).toBe("Code Review");
    expect(json.steps).toHaveLength(3);
    expect(json.inputs).toHaveLength(2);
  });

  it("handles minimal SKILL.MD", () => {
    const minimal = `# Simple\n\n## Description\nA simple skill.`;
    const skill = SkillSpec.fromMarkdown(minimal);
    expect(skill.name).toBe("Simple");
    expect(skill.steps).toHaveLength(0);
  });
});
