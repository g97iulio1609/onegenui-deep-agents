// =============================================================================
// WebSocket Handler — Bidirectional event streaming and command handling
// =============================================================================

import type { EventBus } from "../agent/event-bus.js";

export interface WsCommand {
  type: "pause" | "resume" | "cancel" | "approve" | "deny";
  data?: unknown;
}

export interface WsHandlerOptions {
  eventBus: EventBus;
  /** Callback invoked when a valid command is received from the client. */
  onCommand?: (command: WsCommand) => void | Promise<void>;
}

/** Runtime-agnostic WebSocket interface. */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
}

const VALID_COMMANDS = new Set<string>(["pause", "resume", "cancel", "approve", "deny"]);

/**
 * Binds an EventBus to a WebSocket for bidirectional communication.
 * Events are forwarded as JSON; incoming messages are parsed as commands.
 */
export function handleWebSocket(
  ws: WebSocketLike,
  options: WsHandlerOptions,
): void {
  const { eventBus, onCommand } = options;

  const unsubscribe = eventBus.on("*", (event) => {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // Socket may be closing — ignore send errors
    }
  });

  ws.onmessage = (event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return; // ignore malformed messages
    }

    if (!isValidCommand(parsed)) return;

    onCommand?.(parsed)?.catch?.(() => {
      // Swallow async errors from command handler
    });
  };

  ws.onclose = () => {
    unsubscribe();
    ws.onmessage = null;
    ws.onclose = null;
  };
}

function isValidCommand(value: unknown): value is WsCommand {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === "string" && VALID_COMMANDS.has(obj.type);
}
