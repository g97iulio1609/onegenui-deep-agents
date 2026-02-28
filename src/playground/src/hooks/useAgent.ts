import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  tools: Array<{ name: string; description: string; schema?: Record<string, unknown> }>;
}

export interface ToolCall {
  name: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export interface TimelineEntry {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  label: string;
  durationMs?: number;
  timestamp: number;
}

export interface PlaygroundEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  content?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  durationMs?: number;
  message?: string;
  totalDurationMs?: number;
  tokenCount?: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAgent() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastToolCall, setLastToolCall] = useState<Map<string, ToolCall>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Fetch agents on mount
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data: AgentInfo[]) => setAgents(data))
      .catch(() => { /* ignore */ });
  }, []);

  const sendMessage = useCallback(
    async (agentId: string, prompt: string) => {
      if (isStreaming) return;

      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsStreaming(true);

      const toolCalls: ToolCall[] = [];
      let assistantText = "";

      try {
        abortRef.current = new AbortController();
        const res = await fetch(`/api/agents/${agentId}/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            try {
              const event: PlaygroundEvent = JSON.parse(json);
              processEvent(event, toolCalls, (text) => { assistantText = text; });

              setTimeline((prev) => [
                ...prev,
                {
                  type: event.type,
                  label: eventLabel(event),
                  durationMs: event.durationMs ?? event.totalDurationMs,
                  timestamp: Date.now(),
                },
              ]);
            } catch { /* skip invalid JSON */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          assistantText = `Error: ${(err as Error).message}`;
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
      ]);
      setIsStreaming(false);
    },
    [isStreaming],
  );

  return { agents, messages, timeline, isStreaming, lastToolCall, sendMessage };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function processEvent(
  event: PlaygroundEvent,
  toolCalls: ToolCall[],
  setText: (text: string) => void,
): void {
  switch (event.type) {
    case "text":
      setText(event.content ?? "");
      break;
    case "tool_call":
      toolCalls.push({ name: event.name ?? "unknown", args: event.args });
      break;
    case "tool_result": {
      const existing = toolCalls.find((tc) => tc.name === event.name && tc.result === undefined);
      if (existing) {
        existing.result = event.result;
        existing.durationMs = event.durationMs;
      }
      break;
    }
    case "error":
      setText(event.message ?? "Unknown error");
      break;
  }
}

function eventLabel(event: PlaygroundEvent): string {
  switch (event.type) {
    case "text": return (event.content ?? "").slice(0, 80);
    case "tool_call": return `${event.name}(${JSON.stringify(event.args).slice(0, 60)})`;
    case "tool_result": return `${event.name} → ${JSON.stringify(event.result).slice(0, 60)}`;
    case "error": return event.message ?? "Error";
    case "done": return `Completed in ${event.totalDurationMs}ms`;
    default: return event.type;
  }
}
