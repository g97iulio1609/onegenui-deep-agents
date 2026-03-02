/** Utility functions for @gauss-ai/chat */

let _counter = 0;

/** Generate a unique ID for messages. */
export function generateId(): string {
  return `msg_${Date.now()}_${++_counter}`;
}

/** Create a user ChatMessage from text. */
export function createUserMessage(text: string): import("../types/index.js").ChatMessage {
  return {
    id: generateId(),
    role: "user",
    parts: [{ type: "text", text }],
    createdAt: new Date(),
  };
}

/** Create an assistant ChatMessage from text. */
export function createAssistantMessage(
  text: string,
  id?: string,
): import("../types/index.js").ChatMessage {
  return {
    id: id ?? generateId(),
    role: "assistant",
    parts: [{ type: "text", text }],
    createdAt: new Date(),
  };
}

/** Extract all text from a ChatMessage's parts. */
export function getMessageText(message: import("../types/index.js").ChatMessage): string {
  return message.parts
    .filter((p): p is import("../types/index.js").TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}
