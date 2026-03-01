import type { AgentInfo } from '../types';

/** Pre-configured demo agents shown when no backend is connected. */
export const DEMO_AGENTS: AgentInfo[] = [
  {
    id: 'demo-assistant',
    name: 'Assistant',
    description: 'General-purpose assistant — ask anything.',
    tools: [],
  },
  {
    id: 'demo-coder',
    name: 'Code Reviewer',
    description: 'Reviews code for bugs, style, and performance.',
    tools: [
      { name: 'read_file', description: 'Read a file from disk' },
      { name: 'search_code', description: 'Search codebase by pattern' },
    ],
  },
  {
    id: 'demo-researcher',
    name: 'Researcher',
    description: 'Deep research with web search and summarization.',
    tools: [
      { name: 'web_search', description: 'Search the web' },
      { name: 'summarize', description: 'Summarize long content' },
    ],
  },
  {
    id: 'demo-data-analyst',
    name: 'Data Analyst',
    description: 'Analyze datasets with code execution.',
    tools: [
      { name: 'execute_code', description: 'Run Python/JS/Bash code' },
      { name: 'generate_image', description: 'Generate charts and plots' },
    ],
  },
  {
    id: 'demo-team-lead',
    name: 'Team Lead',
    description: 'Orchestrates a team of specialized agents.',
    tools: [
      { name: 'delegate', description: 'Delegate task to sub-agent' },
      { name: 'summarize_results', description: 'Aggregate sub-agent outputs' },
    ],
  },
];
