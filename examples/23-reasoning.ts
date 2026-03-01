/**
 * Example: Reasoning / Extended Thinking
 * 
 * Shows how to use reasoning_effort (OpenAI o-series) and 
 * thinking_budget (Anthropic extended thinking).
 */
import { Agent, OPENAI_REASONING, ANTHROPIC_PREMIUM } from "gauss-ts";

// ─── OpenAI Reasoning (o4-mini) ─────────────────
const reasoner = new Agent({
  name: "deep-thinker",
  model: OPENAI_REASONING,
  instructions: "You are an expert problem solver. Think carefully.",
  reasoningEffort: "high",
});

// ─── Anthropic Extended Thinking ─────────────────
const thinker = new Agent({
  name: "claude-thinker",
  model: ANTHROPIC_PREMIUM,
  instructions: "Analyze complex problems with deep reasoning.",
  thinkingBudget: 10000,
});

async function main() {
  // OpenAI with reasoning effort
  const result1 = await reasoner.run("What is 27^3 + 14^3?");
  console.log("OpenAI reasoning:", result1.text);
  
  // Anthropic with extended thinking — thinking output is available
  const result2 = await thinker.run("Explain the P vs NP problem.");
  console.log("Anthropic response:", result2.text);
  if (result2.thinking) {
    console.log("Thinking process:", result2.thinking.substring(0, 200) + "...");
  }
}

main().catch(console.error);
