#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import process from 'node:process';

import { evaluatePolicyGate } from '../dist/index.js';

const [, , scenariosPath, policyPath] = process.argv;

if (!scenariosPath) {
  process.stderr.write('Usage: node scripts/policy-gate.mjs <scenarios.json> [policy.json]\n');
  process.exit(2);
}

const parseJsonFile = (path) => JSON.parse(readFileSync(path, 'utf8'));

const scenariosRaw = parseJsonFile(scenariosPath);
if (!Array.isArray(scenariosRaw)) {
  process.stderr.write('scenarios.json must be an array\n');
  process.exit(2);
}

const normalizedScenarios = scenariosRaw.map((scenario, index) => {
  if (!scenario || typeof scenario !== 'object') {
    throw new Error(`scenario ${index} must be an object`);
  }
  const provider = typeof scenario.provider === 'string' ? scenario.provider : 'openai';
  const model = typeof scenario.model === 'string' ? scenario.model : 'gpt-5.2';
  const options = scenario.options && typeof scenario.options === 'object' ? scenario.options : undefined;
  return { provider, model, options };
});

const policy = policyPath ? parseJsonFile(policyPath) : undefined;
const summary = evaluatePolicyGate(policy, normalizedScenarios);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (summary.failed > 0) {
  process.exitCode = 1;
}
