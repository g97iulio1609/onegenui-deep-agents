import { useCallback, useRef, useState } from "react";
import type {
  AgentStatus,
  AgentStreamTrace,
  CostInfo,
  ToolCallInfo,
  UseAgentOptions,
  UseAgentReturn,
} from "../types/index.js";
import { useChat } from "./use-chat.js";

/**
 * React hook for interacting with a specific Gauss agent.
 *
 * Extends useChat with agent selection, memory integration, thinking/tool/cost/trace
 * event handling, and session continuity.
 *
 * @example
 * ```tsx
 * import { useAgent } from "@gauss-ai/chat";
 *
 * function AgentChat() {
 *   const {
 *     messages, sendMessage, agent, setAgent, status,
 *     thinking, activeTools, cost, trace, agentStatus,
 *   } = useAgent({
 *     api: "/api/agent",
 *     agent: "code-reviewer",
 *     enableMemory: true,
 *     onThinking: (text) => console.log("Thinking:", text),
 *     onToolCall: (name, args) => console.log("Tool:", name, args),
 *     onCostUpdate: (c) => console.log("Cost:", c.totalUsd),
 *   });
 *
 *   return (
 *     <div>
 *       {agentStatus === "thinking" && <p>Thinking: {thinking}</p>}
 *       {activeTools.map((t) => <p key={t.toolCallId}>Calling {t.toolName}...</p>)}
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
    onThinking,
    onToolCall,
    onToolResult,
    onCostUpdate,
    onTraceUpdate,
    ...chatOptions
  } = options;

  const [agent, setAgentState] = useState<string | undefined>(initialAgent);
  const [sessionId] = useState<string | undefined>(initialSessionId);
  const [thinking, setThinking] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<ToolCallInfo[]>([]);
  const [cost, setCost] = useState<CostInfo | null>(null);
  const [trace, setTrace] = useState<AgentStreamTrace | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");

  // Refs for callbacks to avoid stale closures
  const onThinkingRef = useRef(onThinking);
  onThinkingRef.current = onThinking;
  const onToolCallRef = useRef(onToolCall);
  onToolCallRef.current = onToolCall;
  const onToolResultRef = useRef(onToolResult);
  onToolResultRef.current = onToolResult;
  const onCostUpdateRef = useRef(onCostUpdate);
  onCostUpdateRef.current = onCostUpdate;
  const onTraceUpdateRef = useRef(onTraceUpdate);
  onTraceUpdateRef.current = onTraceUpdate;

  // Merge agent-specific body params into the chat options
  const chat = useChat({
    ...chatOptions,
    body: {
      ...chatOptions.body,
      agent,
      enableMemory,
      sessionId,
    },
    onFinish: (msg) => {
      setAgentStatus("idle");
      setThinking(null);
      setActiveTools([]);
      chatOptions.onFinish?.(msg);
    },
    onError: (err) => {
      setAgentStatus("error");
      chatOptions.onError?.(err);
    },
  });

  const setAgent = useCallback((newAgent: string) => {
    setAgentState(newAgent);
  }, []);

  // Wrap sendMessage to reset agent-specific state
  const sendMessage = useCallback(
    async (input: Parameters<typeof chat.sendMessage>[0]) => {
      setThinking(null);
      setActiveTools([]);
      setAgentStatus("thinking");
      await chat.sendMessage(input);
    },
    [chat],
  );

  const reset = useCallback(() => {
    chat.reset();
    setThinking(null);
    setActiveTools([]);
    setCost(null);
    setTrace(null);
    setAgentStatus("idle");
  }, [chat]);

  /**
   * Process an agent-specific SSE event.
   * Call this from your transport or event handler to update agent state.
   */
  const processAgentEvent = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      switch (event.type) {
        case "thinking": {
          const text = event.text as string;
          setThinking(text);
          setAgentStatus("thinking");
          onThinkingRef.current?.(text);
          break;
        }
        case "tool-call": {
          const info: ToolCallInfo = {
            toolName: event.toolName as string,
            toolCallId: event.toolCallId as string,
            args: (event.args as Record<string, unknown>) ?? {},
          };
          setActiveTools((prev) => [...prev, info]);
          setAgentStatus("calling-tool");
          onToolCallRef.current?.(info.toolName, info.args);
          break;
        }
        case "tool-result": {
          const callId = event.toolCallId as string;
          setActiveTools((prev) => {
            const updated = prev.map((t) =>
              t.toolCallId === callId ? { ...t, result: event.result } : t,
            );
            const toolInfo = updated.find((t) => t.toolCallId === callId);
            if (toolInfo) {
              onToolResultRef.current?.(toolInfo.toolName, event.result);
            }
            return updated;
          });
          setAgentStatus("streaming");
          break;
        }
        case "cost": {
          const costInfo: CostInfo = {
            totalUsd: event.totalUsd as number,
            stepCosts: event.stepCosts as number[],
          };
          setCost(costInfo);
          onCostUpdateRef.current?.(costInfo);
          break;
        }
        case "trace": {
          const traceData = event.trace as AgentStreamTrace;
          setTrace(traceData);
          onTraceUpdateRef.current?.(traceData);
          break;
        }
        case "text-delta":
          setAgentStatus("streaming");
          break;
      }
    },
    [],
  );

  return {
    ...chat,
    sendMessage,
    reset,
    agent,
    setAgent,
    sessionId,
    thinking,
    activeTools,
    cost,
    trace,
    agentStatus,
    processAgentEvent,
  };
}
