import { useCallback, useEffect, useRef, useState } from "react";
import { GaussTransport } from "../transport/gauss-transport.js";
import type {
  ChatMessage,
  ChatStatus,
  ChatTransport,
  UseCompletionOptions,
  UseCompletionReturn,
} from "../types/index.js";
import { generateId } from "../utils/index.js";

/**
 * React hook for single-turn text completions with streaming.
 *
 * @example
 * ```tsx
 * import { useCompletion } from "@gauss-ai/chat";
 *
 * function Completion() {
 *   const { completion, complete, isLoading, stop } = useCompletion({
 *     api: "/api/completion",
 *   });
 *
 *   return (
 *     <div>
 *       <p>{completion}</p>
 *       <button onClick={() => complete("Write a haiku about AI")}>Generate</button>
 *       {isLoading && <button onClick={stop}>Stop</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompletion(options: UseCompletionOptions = {}): UseCompletionReturn {
  const {
    api = "/api/completion",
    headers,
    body,
    transport: customTransport,
    credentials,
    onError,
    onFinish,
  } = options;

  const [completion, setCompletion] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
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

  const complete = useCallback(
    async (prompt: string) => {
      setCompletion("");
      setStatus("loading");
      setError(null);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const messages: ChatMessage[] = [
          {
            id: generateId(),
            role: "user",
            parts: [{ type: "text", text: prompt }],
          },
        ];

        const stream = transportRef.current.send(messages, {
          api,
          headers,
          body,
          signal: abortController.signal,
          credentials,
        });

        let text = "";
        let started = false;

        for await (const event of stream) {
          if (abortController.signal.aborted) break;

          if (!started) {
            setStatus("streaming");
            started = true;
          }

          if (event.type === "text-delta") {
            text += event.text;
            setCompletion(text);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }

        const finalMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          parts: [{ type: "text", text }],
          createdAt: new Date(),
        };

        onFinish?.(finalMessage);
      } catch (err) {
        const isAbort = err != null && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError";
        if (isAbort) {
          setStatus("idle");
          return;
        }
        const completionError = err instanceof Error ? err : new Error(String(err));
        setError(completionError);
        setStatus("error");
        onError?.(completionError);
      } finally {
        abortRef.current = null;
        setStatus((prev) => (prev === "error" ? "error" : "idle"));
      }
    },
    [api, body, credentials, headers, onError, onFinish],
  );

  return {
    completion,
    complete,
    status,
    error,
    stop,
    isLoading: status === "loading" || status === "streaming",
  };
}
