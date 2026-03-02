import { useCallback, useState } from "react";
import type { UseAgentOptions, UseAgentReturn } from "../types/index.js";
import { useChat } from "./use-chat.js";

/**
 * React hook for interacting with a specific Gauss agent.
 *
 * Extends useChat with agent selection, memory integration, and session continuity.
 *
 * @example
 * ```tsx
 * import { useAgent } from "@gauss-ai/chat";
 *
 * function AgentChat() {
 *   const { messages, sendMessage, agent, setAgent, status } = useAgent({
 *     api: "/api/agent",
 *     agent: "code-reviewer",
 *     enableMemory: true,
 *   });
 *
 *   return (
 *     <div>
 *       <select value={agent} onChange={(e) => setAgent(e.target.value)}>
 *         <option value="code-reviewer">Code Reviewer</option>
 *         <option value="assistant">General Assistant</option>
 *       </select>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.parts.map(p => p.type === "text" ? p.text : null)}</div>
 *       ))}
 *       <button onClick={() => sendMessage("Review this code")}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const {
    agent: initialAgent,
    enableMemory = false,
    sessionId: initialSessionId,
    ...chatOptions
  } = options;

  const [agent, setAgentState] = useState<string | undefined>(initialAgent);
  const [sessionId] = useState<string | undefined>(initialSessionId);

  // Merge agent-specific body params into the chat options
  const chat = useChat({
    ...chatOptions,
    body: {
      ...chatOptions.body,
      agent,
      enableMemory,
      sessionId,
    },
  });

  const setAgent = useCallback((newAgent: string) => {
    setAgentState(newAgent);
  }, []);

  return {
    ...chat,
    agent,
    setAgent,
    sessionId,
  };
}
