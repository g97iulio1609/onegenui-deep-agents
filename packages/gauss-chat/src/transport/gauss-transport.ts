/**
 * SSE-based transport for communicating with a Gauss-powered API.
 *
 * Sends messages as JSON via POST and reads back a stream of
 * newline-delimited JSON events (Server-Sent Events style).
 */

import type {
  ChatMessage,
  ChatTransport,
  StreamEvent,
  TransportOptions,
} from "../types/index.js";

/** Default SSE transport — POST JSON, stream back NDJSON events. */
export class GaussTransport implements ChatTransport {
  private readonly defaults: Partial<TransportOptions>;

  constructor(options?: Partial<TransportOptions>) {
    this.defaults = options ?? {};
  }

  async *send(
    messages: ChatMessage[],
    options: TransportOptions & { signal: AbortSignal },
  ): AsyncIterable<StreamEvent> {
    const api = options.api ?? this.defaults.api ?? "/api/chat";
    const headers = {
      "Content-Type": "application/json",
      ...this.defaults.headers,
      ...options.headers,
    };
    const body = {
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
      })),
      ...this.defaults.body,
      ...options.body,
    };

    const response = await fetch(api, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
      credentials: options.credentials ?? this.defaults.credentials,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      yield { type: "error", error: `HTTP ${response.status}: ${errorText}` };
      return;
    }

    if (!response.body) {
      yield { type: "error", error: "Response body is null" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          // Handle SSE data: prefix
          const data = trimmed.startsWith("data: ")
            ? trimmed.slice(6)
            : trimmed;

          if (data === "[DONE]") {
            yield { type: "finish", finishReason: "stop" };
            return;
          }

          try {
            const event = JSON.parse(data) as StreamEvent;
            yield event;
          } catch {
            // Handle plain text streaming (non-JSON lines)
            yield { type: "text-delta", text: data };
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as StreamEvent;
          yield event;
        } catch {
          yield { type: "text-delta", text: buffer.trim() };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
