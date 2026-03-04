import { useCallback, useMemo, useRef, useState } from "react";
import type { UseChatOptions, UseChatReturn } from "../types/index.js";
import { useChat } from "./use-chat.js";

/** Configuration for a single agent in a multi-agent setup. */
export interface AgentConfig {
  /** Unique agent identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** API endpoint for this agent. Default: "/api/chat". */
  api?: string;
  /** System prompt for this agent. */
  systemPrompt?: string;
  /** Extra body data merged into requests. */
  body?: Record<string, unknown>;
}

export interface UseMultiAgentOptions extends Omit<UseChatOptions, "api" | "systemPrompt" | "body"> {
  /** List of available agents. At least one required. */
  agents: AgentConfig[];
  /** Initial active agent ID. Defaults to first agent. */
  defaultAgent?: string;
  /** Shared headers for all agents. */
  headers?: Record<string, string>;
}

export interface UseMultiAgentReturn extends Omit<UseChatReturn, "sendMessage"> {
  /** Currently active agent config. */
  activeAgent: AgentConfig;
  /** All configured agents. */
  agents: AgentConfig[];
  /** Switch the active agent. Messages are preserved. */
  switchAgent: (agentId: string) => void;
  /** Send a message via the currently active agent. */
  sendMessage: (message: string) => Promise<void>;
  /** Per-agent message counts. */
  messageCounts: Record<string, number>;
}

/**
 * React hook for multi-agent chat — switch between agents in a single conversation.
 *
 * @example
 * ```tsx
 * import { useMultiAgent } from "@gauss-ai/chat";
 *
 * function MultiAgentChat() {
 *   const {
 *     messages, sendMessage, activeAgent, switchAgent, agents,
 *   } = useMultiAgent({
 *     agents: [
 *       { id: "coder", name: "Coder", api: "/api/agent/coder" },
 *       { id: "reviewer", name: "Reviewer", api: "/api/agent/reviewer" },
 *       { id: "writer", name: "Writer", api: "/api/agent/writer" },
 *     ],
 *   });
 *
 *   return (
 *     <div>
 *       <div>
 *         {agents.map(a => (
 *           <button key={a.id} onClick={() => switchAgent(a.id)}>
 *             {a.name} {a.id === activeAgent.id && "✓"}
 *           </button>
 *         ))}
 *       </div>
 *       {messages.map(m => <p key={m.id}>{m.parts[0]?.type === "text" && m.parts[0].text}</p>)}
 *       <button onClick={() => sendMessage("Hello!")}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMultiAgent(options: UseMultiAgentOptions): UseMultiAgentReturn {
  const { agents, defaultAgent, headers, ...restOptions } = options;

  if (agents.length === 0) {
    throw new Error("useMultiAgent requires at least one agent configuration.");
  }

  const [activeId, setActiveId] = useState(defaultAgent ?? agents[0].id);
  const countsRef = useRef<Record<string, number>>({});
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeId) ?? agents[0],
    [agents, activeId],
  );

  const chatOptions: UseChatOptions = useMemo(
    () => ({
      ...restOptions,
      api: activeAgent.api,
      systemPrompt: activeAgent.systemPrompt,
      headers,
      body: {
        ...activeAgent.body,
        agentId: activeAgent.id,
      },
    }),
    [restOptions, activeAgent, headers],
  );

  const chat = useChat(chatOptions);

  const sendMessage = useCallback(
    async (message: string) => {
      countsRef.current[activeAgent.id] = (countsRef.current[activeAgent.id] ?? 0) + 1;
      setMessageCounts({ ...countsRef.current });
      await chat.sendMessage(message);
    },
    [chat, activeAgent.id],
  );

  const switchAgent = useCallback(
    (agentId: string) => {
      const found = agents.find((a) => a.id === agentId);
      if (found) {
        setActiveId(agentId);
      }
    },
    [agents],
  );

  return {
    ...chat,
    sendMessage,
    activeAgent,
    agents,
    switchAgent,
    messageCounts,
  };
}
