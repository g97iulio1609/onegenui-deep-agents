/** In-memory chat storage adapter for testing and SSR. */

import type { ChatMessage } from "../types/index.js";
import type { ChatStorage } from "./storage.js";

/** Stores chat messages in a Map (non-persistent). */
export class MemoryStorageAdapter implements ChatStorage {
  private store = new Map<string, ChatMessage[]>();

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    return structuredClone(this.store.get(conversationId) ?? []);
  }

  async saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    this.store.set(conversationId, structuredClone(messages));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
  }

  async listConversations(): Promise<string[]> {
    return [...this.store.keys()];
  }
}
