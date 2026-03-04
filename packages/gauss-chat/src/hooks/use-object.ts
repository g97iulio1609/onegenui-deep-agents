import { useCallback, useRef, useState } from "react";
import { GaussTransport } from "../transport/gauss-transport.js";
import type {
  ChatMessage,
  ChatStatus,
  ChatTransport,
  UseObjectOptions,
  UseObjectReturn,
} from "../types/index.js";
import { generateId } from "../utils/index.js";

/**
 * React hook for streaming typed JSON objects from the server.
 *
 * Progressively updates the object as tokens arrive, validating
 * each partial result through the provided schema.
 *
 * @example
 * ```tsx
 * import { useObject } from "@gauss-ai/chat";
 *
 * const schema = {
 *   parse: (input: unknown) => input as { name: string; age: number },
 * };
 *
 * function Profile() {
 *   const { object, submit, isLoading } = useObject({ schema });
 *
 *   return (
 *     <div>
 *       {object && <p>{object.name}, {object.age}</p>}
 *       <button onClick={() => submit("Generate a user profile")}>Go</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useObject<T>(options: UseObjectOptions<T>): UseObjectReturn<T> {
  const {
    api = "/api/object",
    schema,
    headers,
    body,
    transport: customTransport,
    credentials,
    onError,
    onFinish,
    onPartialObject,
  } = options;

  const [object, setObject] = useState<T | undefined>(undefined);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const transportRef = useRef<ChatTransport>(
    customTransport ?? new GaussTransport({ api, headers, body, credentials }),
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const submit = useCallback(
    async (prompt: string) => {
      setObject(undefined);
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
          body: { ...body, schema: "json" },
          signal: abortController.signal,
          credentials,
        });

        let accumulated = "";
        let lastValidObject: T | undefined;
        let started = false;

        for await (const event of stream) {
          if (abortController.signal.aborted) break;

          if (!started) {
            setStatus("streaming");
            started = true;
          }

          if (event.type === "text-delta") {
            accumulated += event.text;

            try {
              const parsed = JSON.parse(accumulated);
              const validated = schema.parse(parsed);
              lastValidObject = validated;
              setObject(validated);
              onPartialObject?.(validated as Partial<T>);
            } catch {
              // Try partial JSON repair: close unclosed structures
              const partial = tryParsePartial(accumulated);
              if (partial !== null) {
                try {
                  const validated = schema.parse(partial);
                  lastValidObject = validated;
                  setObject(validated);
                  onPartialObject?.(validated as Partial<T>);
                } catch {
                  // Schema validation failed on partial — keep last valid
                }
              }
            }
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }

        // Final validation
        if (accumulated) {
          try {
            const finalParsed = JSON.parse(accumulated);
            const finalValidated = schema.parse(finalParsed);
            lastValidObject = finalValidated;
            setObject(finalValidated);
          } catch (parseErr) {
            throw new Error(
              `Failed to parse final object: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
            );
          }
        }

        if (lastValidObject !== undefined) {
          const finalMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            parts: [{ type: "text", text: accumulated }],
            createdAt: new Date(),
          };
          onFinish?.(finalMessage);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        const objectError = err instanceof Error ? err : new Error(String(err));
        setError(objectError);
        setStatus("error");
        onError?.(objectError);
      } finally {
        abortRef.current = null;
        setStatus((prev) => (prev === "error" ? "error" : "idle"));
      }
    },
    [api, body, credentials, headers, onError, onFinish, onPartialObject, schema],
  );

  return {
    object,
    submit,
    status,
    error,
    stop,
    isLoading: status === "loading" || status === "streaming",
  };
}

/**
 * Attempt to parse incomplete JSON by closing unclosed structures.
 * @internal
 */
function tryParsePartial(json: string): unknown | null {
  const trimmed = json.trim();
  if (!trimmed) return null;

  const closers: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }

  if (closers.length === 0) return null;

  let repaired = trimmed;
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/:\s*$/, ": null");

  while (closers.length > 0) {
    repaired += closers.pop();
  }

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}
