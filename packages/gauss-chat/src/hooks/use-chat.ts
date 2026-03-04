import { useCallback, useEffect, useRef, useState } from "react";
import { GaussTransport } from "../transport/gauss-transport.js";
import type {
  ChatMessage,
  ChatStatus,
  ChatTransport,
  SendMessageOptions,
  StreamEvent,
  UseChatOptions,
  UseChatReturn,
} from "../types/index.js";
import { createAssistantMessage, createUserMessage, generateId } from "../utils/index.js";

/**
 * React hook for building chat interfaces with Gauss.
 *
 * Manages message state, streaming, tool calls, and error handling.
 *
 * @example
 * ```tsx
 * import { useChat } from "@gauss-ai/chat";
 *
 * function Chat() {
 *   const { messages, sendMessage, status, stop } = useChat({
 *     api: "/api/chat",
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.parts.map(p => p.type === "text" ? p.text : null)}</div>
 *       ))}
 *       <button onClick={() => sendMessage("Hello!")}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    api = "/api/chat",
    initialMessages = [],
    systemPrompt,
    headers,
    body,
    transport: customTransport,
    credentials,
    onError,
    onFinish,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const transportRef = useRef<ChatTransport>(
    customTransport ?? new GaussTransport({ api, headers, body, credentials }),
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const sendMessage = useCallback(
    async (input: SendMessageOptions | string) => {
      const text = typeof input === "string" ? input : input.text;
      const extraData = typeof input === "string" ? undefined : input.data;

      const userMessage = createUserMessage(text);
      const assistantId = generateId();

      setMessages((prev) => [...prev, userMessage]);
      setStatus("loading");
      setError(null);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        // Build messages to send (include system prompt if set)
        const allMessages: ChatMessage[] = [];
        if (systemPrompt) {
          allMessages.push({
            id: "system",
            role: "system",
            parts: [{ type: "text", text: systemPrompt }],
          });
        }

        // Use functional update to get latest messages
        let currentMessages: ChatMessage[] = [];
        setMessages((prev) => {
          currentMessages = prev;
          return prev;
        });

        allMessages.push(...currentMessages);

        const stream = transportRef.current.send(allMessages, {
          api,
          headers,
          body: { ...body, ...extraData },
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

          processStreamEvent(event, assistantId, assistantText, assistantParts, setMessages);

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
          id: assistantId,
          role: "assistant",
          parts: finalParts.length > 0 ? finalParts : [{ type: "text", text: "" }],
          createdAt: new Date(),
        };

        if (mountedRef.current) {
          setMessages((prev) => {
            const withoutStreaming = prev.filter((m) => m.id !== assistantId);
            return [...withoutStreaming, finalMessage];
          });
        }

        onFinish?.(finalMessage);
      } catch (err) {
        const isAbort = err != null && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError";
        if (isAbort) {
          if (mountedRef.current) setStatus("idle");
          return;
        }
        const chatError = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(chatError);
          setStatus("error");
        }
        onError?.(chatError);
      } finally {
        abortRef.current = null;
        if (mountedRef.current) {
          setStatus((prev) => (prev === "error" ? "error" : "idle"));
        }
      }
    },
    [api, body, credentials, headers, onError, onFinish, systemPrompt],
  );

  const reset = useCallback(() => {
    stop();
    setMessages(initialMessages);
    setError(null);
    setStatus("idle");
  }, [initialMessages, stop]);

  return {
    messages,
    sendMessage,
    status,
    error,
    stop,
    reset,
    isLoading: status === "loading" || status === "streaming",
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
