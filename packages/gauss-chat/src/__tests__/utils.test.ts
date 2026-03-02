import { describe, expect, it } from "vitest";
import {
  createAssistantMessage,
  createUserMessage,
  generateId,
  getMessageText,
} from "../utils/index.js";
import type { ChatMessage } from "../types/index.js";

describe("utils", () => {
  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it("should start with msg_ prefix", () => {
      const id = generateId();
      expect(id).toMatch(/^msg_\d+_\d+$/);
    });
  });

  describe("createUserMessage", () => {
    it("should create a user message with text part", () => {
      const msg = createUserMessage("Hello!");
      expect(msg.role).toBe("user");
      expect(msg.parts).toHaveLength(1);
      expect(msg.parts[0]).toEqual({ type: "text", text: "Hello!" });
      expect(msg.id).toBeTruthy();
      expect(msg.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("createAssistantMessage", () => {
    it("should create an assistant message with text part", () => {
      const msg = createAssistantMessage("Hi there!");
      expect(msg.role).toBe("assistant");
      expect(msg.parts).toHaveLength(1);
      expect(msg.parts[0]).toEqual({ type: "text", text: "Hi there!" });
    });

    it("should accept a custom ID", () => {
      const msg = createAssistantMessage("Hi", "custom-id");
      expect(msg.id).toBe("custom-id");
    });
  });

  describe("getMessageText", () => {
    it("should extract text from a simple message", () => {
      const msg = createUserMessage("Hello!");
      expect(getMessageText(msg)).toBe("Hello!");
    });

    it("should concatenate multiple text parts", () => {
      const msg: ChatMessage = {
        id: "test",
        role: "assistant",
        parts: [
          { type: "text", text: "Hello " },
          { type: "tool-call", toolName: "search", toolCallId: "tc1", args: {} },
          { type: "text", text: "World" },
        ],
      };
      expect(getMessageText(msg)).toBe("Hello World");
    });

    it("should return empty string for no text parts", () => {
      const msg: ChatMessage = {
        id: "test",
        role: "assistant",
        parts: [
          { type: "tool-call", toolName: "search", toolCallId: "tc1", args: {} },
        ],
      };
      expect(getMessageText(msg)).toBe("");
    });
  });
});
