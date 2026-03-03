import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageAdapter } from "../persistence/local-storage.js";
import { MemoryStorageAdapter } from "../persistence/memory-storage.js";
import { usePersistentChat } from "../hooks/use-persistent-chat.js";
import type { ChatMessage, ChatTransport, StreamEvent } from "../types/index.js";

// ─── Helpers ────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    role: "user",
    parts: [{ type: "text", text: "hello" }],
    createdAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function createMockTransport(events: StreamEvent[]): ChatTransport {
  return {
    async *send() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

// ─── LocalStorageAdapter ────────────────────────────────────────────

describe("LocalStorageAdapter", () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter("test");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty array for unknown conversation", async () => {
    expect(await adapter.getMessages("unknown")).toEqual([]);
  });

  it("saves and retrieves messages", async () => {
    const msgs = [makeMessage()];
    await adapter.saveMessages("c1", msgs);
    const result = await adapter.getMessages("c1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
    expect(result[0].parts[0]).toEqual({ type: "text", text: "hello" });
  });

  it("deserializes createdAt as Date", async () => {
    await adapter.saveMessages("c1", [makeMessage()]);
    const result = await adapter.getMessages("c1");

    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[0].createdAt!.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("handles messages without createdAt", async () => {
    const msg = makeMessage();
    delete (msg as Partial<ChatMessage>).createdAt;
    await adapter.saveMessages("c1", [msg]);
    const result = await adapter.getMessages("c1");

    expect(result[0].createdAt).toBeUndefined();
  });

  it("lists conversations", async () => {
    await adapter.saveMessages("c1", [makeMessage()]);
    await adapter.saveMessages("c2", [makeMessage({ id: "m2" })]);

    const ids = await adapter.listConversations();
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("does not duplicate conversation IDs in index", async () => {
    await adapter.saveMessages("c1", [makeMessage()]);
    await adapter.saveMessages("c1", [makeMessage()]);

    const ids = await adapter.listConversations();
    expect(ids.filter((id) => id === "c1")).toHaveLength(1);
  });

  it("deletes a conversation", async () => {
    await adapter.saveMessages("c1", [makeMessage()]);
    await adapter.deleteConversation("c1");

    expect(await adapter.getMessages("c1")).toEqual([]);
    expect(await adapter.listConversations()).not.toContain("c1");
  });

  it("uses custom prefix for keys", async () => {
    const custom = new LocalStorageAdapter("custom");
    await custom.saveMessages("c1", [makeMessage()]);

    expect(localStorage.getItem("custom:c1")).not.toBeNull();
    expect(localStorage.getItem("test:c1")).toBeNull();
  });
});

// ─── MemoryStorageAdapter ───────────────────────────────────────────

describe("MemoryStorageAdapter", () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
  });

  it("returns empty array for unknown conversation", async () => {
    expect(await adapter.getMessages("unknown")).toEqual([]);
  });

  it("saves and retrieves messages", async () => {
    const msgs = [makeMessage()];
    await adapter.saveMessages("c1", msgs);
    const result = await adapter.getMessages("c1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("returns a deep copy (no shared references)", async () => {
    const msgs = [makeMessage()];
    await adapter.saveMessages("c1", msgs);

    const a = await adapter.getMessages("c1");
    const b = await adapter.getMessages("c1");
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
  });

  it("lists conversations", async () => {
    await adapter.saveMessages("c1", [makeMessage()]);
    await adapter.saveMessages("c2", [makeMessage({ id: "m2" })]);

    const ids = await adapter.listConversations();
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("deletes a conversation", async () => {
    await adapter.saveMessages("c1", [makeMessage()]);
    await adapter.deleteConversation("c1");

    expect(await adapter.getMessages("c1")).toEqual([]);
    expect(await adapter.listConversations()).not.toContain("c1");
  });
});

// ─── usePersistentChat ──────────────────────────────────────────────

describe("usePersistentChat", () => {
  it("loads messages from storage on mount", async () => {
    const storage = new MemoryStorageAdapter();
    const stored = [makeMessage(), makeMessage({ id: "m2", role: "assistant" })];
    await storage.saveMessages("conv1", stored);

    const transport = createMockTransport([]);

    const { result } = renderHook(() =>
      usePersistentChat({
        storage,
        conversationId: "conv1",
        transport,
      }),
    );

    // Wait for async load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.conversationId).toBe("conv1");
  });

  it("saves messages to storage after assistant response", async () => {
    const storage = new MemoryStorageAdapter();
    const transport = createMockTransport([
      { type: "text-delta", text: "Hi!" },
      { type: "finish", finishReason: "stop" },
    ]);

    const { result } = renderHook(() =>
      usePersistentChat({
        storage,
        conversationId: "conv1",
        transport,
      }),
    );

    // Wait for load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // Wait for persistence effect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const saved = await storage.getMessages("conv1");
    expect(saved.length).toBeGreaterThanOrEqual(2);
    expect(saved[0].role).toBe("user");
    expect(saved[1].role).toBe("assistant");
  });

  it("deleteConversation removes from storage and resets chat", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.saveMessages("conv1", [makeMessage()]);

    const transport = createMockTransport([]);

    const { result } = renderHook(() =>
      usePersistentChat({
        storage,
        conversationId: "conv1",
        transport,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      await result.current.deleteConversation();
    });

    expect(result.current.messages).toEqual([]);
    expect(await storage.getMessages("conv1")).toEqual([]);
  });
});
