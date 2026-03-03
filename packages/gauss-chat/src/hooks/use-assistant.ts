import { useCallback, useRef, useState } from "react";
import { GaussTransport } from "../transport/gauss-transport.js";
import type {
  ChatMessage,
  ChatStatus,
  ChatTransport,
  SendMessageOptions,
  StreamEvent,
  UseAssistantOptions,
  UseAssistantReturn,
} from "../types/index.js";
import { createAssistantMessage, createUserMessage, generateId } from "../utils/index.js";

/**
 * React hook for thread-based assistant interactions with Gauss.
 *
 * Manages thread lifecycle, message history, run polling, and streaming.
 *
 * @example
 * ```tsx
 * import { useAssistant } from "@gauss-ai/chat";
 *
 * function Assistant() {
 *   const { messages, sendMessage, status, threadId, cancel } = useAssistant({
 *     api: "/api/assistant",
 *     assistantId: "asst_abc123",
 *   });
 *
 *   return (
 *     <div>
 *       <p>Thread: {threadId}</p>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.parts.map(p => p.type === "text" ? p.text : null)}</div>
 *       ))}
 *       <button onClick={() => sendMessage("Hello!")}>Send</button>
 *       <button onClick={cancel}>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssistant(options: UseAssistantOptions = {}): UseAssistantReturn {
  const {
    api = "/api/assistant",
    threadId: initialThreadId,
    assistantId,
    headers,
    body,
    transport: customTransport,
    credentials,
    onError,
    onFinish,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [threadId, setThreadIdState] = useState<string | undefined>(initialThreadId);

  const abortRef = useRef<AbortController | null>(null);
  const transportRef = useRef<ChatTransport>(
    customTransport ?? new GaussTransport({ api, headers, body, credentials }),
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const setThreadId = useCallback((id: string) => {
    setThreadIdState(id);
    setMessages([]);
    setError(null);
    setStatus("idle");
  }, []);

  const sendMessage = useCallback(
    async (input: SendMessageOptions | string) => {
      const text = typeof input === "string" ? input : input.text;
      const extraData = typeof input === "string" ? undefined : input.data;

      const userMessage = createUserMessage(text);
      const assistantMsgId = generateId();

      setMessages((prev) => [...prev, userMessage]);
      setStatus("loading");
      setError(null);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        let currentMessages: ChatMessage[] = [];
        setMessages((prev) => {
          currentMessages = prev;
          return prev;
        });

        const stream = transportRef.current.send(currentMessages, {
          api,
          headers,
          body: {
            ...body,
            ...extraData,
            threadId,
            assistantId,
            message: text,
          },
          signal: abortController.signal,
          credentials,
        });

        let assistantText = "";
        const assistantParts: ChatMessage["parts"] = [];
        let started = false;

        for await (const event of stream) {
          if (abortController.signal.aborted) break;

          if (!started) {
            setStatus("streaming");
            started = true;
          }

          // Handle threadId from server response
          if ("threadId" in event && typeof (event as Record<string, unknown>).threadId === "string") {
            setThreadIdState((event as Record<string, unknown>).threadId as string);
          }

          processStreamEvent(event, assistantMsgId, assistantText, assistantParts, setMessages);

          if (event.type === "text-delta") {
            assistantText += event.text;
          }
        }

        // Build final message
        const finalParts = [...assistantParts];
        if (assistantText) {
          const existingTextIdx = finalParts.findIndex((p) => p.type === "text");
          if (existingTextIdx >= 0) {
            finalParts[existingTextIdx] = { type: "text", text: assistantText };
          } else {
            finalParts.unshift({ type: "text", text: assistantText });
          }
        }

        const finalMessage: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          parts: finalParts.length > 0 ? finalParts : [{ type: "text", text: "" }],
          createdAt: new Date(),
        };

        setMessages((prev) => {
          const withoutStreaming = prev.filter((m) => m.id !== assistantMsgId);
          return [...withoutStreaming, finalMessage];
        });

        onFinish?.(finalMessage);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        const chatError = err instanceof Error ? err : new Error(String(err));
        setError(chatError);
        setStatus("error");
        onError?.(chatError);
      } finally {
        abortRef.current = null;
        setStatus((prev) => (prev === "error" ? "error" : "idle"));
      }
    },
    [api, assistantId, body, credentials, headers, onError, onFinish, threadId],
  );

  return {
    messages,
    sendMessage,
    status,
    error,
    threadId,
    cancel,
    isRunning: status === "loading" || status === "streaming",
    setThreadId,
  };
}

/** Process a single stream event and update messages state. */
function processStreamEvent(
  event: StreamEvent,
  assistantId: string,
  currentText: string,
  parts: ChatMessage["parts"],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): void {
  switch (event.type) {
    case "text-delta": {
      const newText = currentText + event.text;
      setMessages((prev) => {
        const existing = prev.find((m) => m.id === assistantId);
        if (existing) {
          return prev.map((m) =>
            m.id === assistantId
              ? { ...m, parts: [{ type: "text" as const, text: newText }] }
              : m,
          );
        }
        return [
          ...prev,
          createAssistantMessage(newText, assistantId),
        ];
      });
      break;
    }
    case "tool-call": {
      parts.push({
        type: "tool-call",
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        args: event.args,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, parts: [...parts] } : m,
        ),
      );
      break;
    }
    case "tool-result": {
      parts.push({
        type: "tool-result",
        toolCallId: event.toolCallId,
        result: event.result,
      });
      break;
    }
    case "error": {
      throw new Error(event.error);
    }
  }
}
