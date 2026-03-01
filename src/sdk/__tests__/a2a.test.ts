import { describe, it, expect, vi } from 'vitest';
import {
  A2aClient,
  textMessage,
  userMessage,
  agentMessage,
  extractText,
  taskText,
} from '../a2a.js';
import type {
  A2aMessage,
  AgentCard,
  Task,
  TaskStatus,
} from '../a2a.js';

// ── Helper Builders Tests ────────────────────────────────────────────────────

describe('A2A Helper Builders', () => {
  it('textMessage creates a message with correct role and text part', () => {
    const msg = textMessage('user', 'Hello');
    expect(msg.role).toBe('user');
    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0]).toEqual({ type: 'text', text: 'Hello' });
  });

  it('userMessage creates a user message', () => {
    const msg = userMessage('Hi there');
    expect(msg.role).toBe('user');
    expect(msg.parts[0].text).toBe('Hi there');
  });

  it('agentMessage creates an agent message', () => {
    const msg = agentMessage('I can help!');
    expect(msg.role).toBe('agent');
    expect(msg.parts[0].text).toBe('I can help!');
  });

  it('extractText joins all text parts', () => {
    const msg: A2aMessage = {
      role: 'agent',
      parts: [
        { type: 'text', text: 'Hello ' },
        { type: 'data', data: { key: 'value' } },
        { type: 'text', text: 'World' },
      ],
    };
    expect(extractText(msg)).toBe('Hello World');
  });

  it('extractText returns empty for non-text parts', () => {
    const msg: A2aMessage = {
      role: 'agent',
      parts: [{ type: 'data', data: 42 }],
    };
    expect(extractText(msg)).toBe('');
  });

  it('taskText extracts text from task status message', () => {
    const task: Task = {
      id: 'test-1',
      status: {
        state: 'completed',
        message: { role: 'agent', parts: [{ type: 'text', text: 'Done!' }] },
      },
    };
    expect(taskText(task)).toBe('Done!');
  });

  it('taskText returns undefined when no status message', () => {
    const task: Task = {
      id: 'test-2',
      status: { state: 'submitted' },
    };
    expect(taskText(task)).toBeUndefined();
  });
});

// ── A2aClient Construction Tests ─────────────────────────────────────────────

describe('A2aClient', () => {
  it('constructs with string URL', () => {
    const client = new A2aClient('http://localhost:8080');
    expect(client).toBeDefined();
  });

  it('constructs with options object', () => {
    const client = new A2aClient({
      baseUrl: 'http://localhost:8080',
      authToken: 'test-token',
    });
    expect(client).toBeDefined();
  });

  it('constructs without authToken', () => {
    const client = new A2aClient({ baseUrl: 'http://localhost:8080' });
    expect(client).toBeDefined();
  });
});

// ── Type Tests ───────────────────────────────────────────────────────────────

describe('A2A Types', () => {
  it('AgentCard shape', () => {
    const card: AgentCard = {
      name: 'Test Agent',
      url: 'http://localhost:8080',
      version: '1.0.0',
      capabilities: { streaming: true, pushNotifications: false },
      skills: [
        {
          id: 'summarize',
          name: 'Summarize',
          description: 'Summarize text',
          tags: ['nlp'],
        },
      ],
    };
    expect(card.name).toBe('Test Agent');
    expect(card.capabilities?.streaming).toBe(true);
    expect(card.skills).toHaveLength(1);
    expect(card.skills![0].id).toBe('summarize');
  });

  it('Task shape', () => {
    const task: Task = {
      id: 'task-001',
      sessionId: 'session-abc',
      status: {
        state: 'working',
        timestamp: '2024-01-01T00:00:00Z',
      },
      artifacts: [
        {
          name: 'result',
          parts: [{ type: 'text', text: 'output' }],
          index: 0,
        },
      ],
      history: [
        { role: 'user', parts: [{ type: 'text', text: 'input' }] },
        { role: 'agent', parts: [{ type: 'text', text: 'output' }] },
      ],
    };
    expect(task.status.state).toBe('working');
    expect(task.artifacts).toHaveLength(1);
    expect(task.history).toHaveLength(2);
  });

  it('TaskStatus states', () => {
    const states: TaskStatus['state'][] = [
      'submitted',
      'working',
      'input-required',
      'completed',
      'canceled',
      'failed',
      'unknown',
    ];
    for (const state of states) {
      const status: TaskStatus = { state };
      expect(status.state).toBe(state);
    }
  });

  it('Part types', () => {
    const textPart = { type: 'text' as const, text: 'hello' };
    const dataPart = { type: 'data' as const, data: { key: 'val' } };
    const filePart = {
      type: 'file' as const,
      file: { name: 'doc.pdf', mimeType: 'application/pdf' },
    };
    expect(textPart.type).toBe('text');
    expect(dataPart.type).toBe('data');
    expect(filePart.type).toBe('file');
  });

  it('A2aMessage with metadata', () => {
    const msg: A2aMessage = {
      role: 'user',
      parts: [{ type: 'text', text: 'test' }],
      metadata: { source: 'cli', priority: 'high' },
    };
    expect(msg.metadata?.source).toBe('cli');
    expect(msg.metadata?.priority).toBe('high');
  });
});
