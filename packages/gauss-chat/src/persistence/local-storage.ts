/** localStorage-based chat storage adapter. */

import type { ChatMessage } from "../types/index.js";
import type { ChatStorage } from "./storage.js";

/** Stores chat messages in localStorage as JSON. */
export class LocalStorageAdapter implements ChatStorage {
  private readonly prefix: string;

  constructor(prefix = "gauss-chat") {
    this.prefix = prefix;
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const raw = localStorage.getItem(this.key(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<ChatMessage & { createdAt?: string }>;
    return parsed.map((m) => ({
      ...m,
      createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
    }));
  }

  async saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    localStorage.setItem(this.key(conversationId), JSON.stringify(messages));
    this.addToIndex(conversationId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    localStorage.removeItem(this.key(conversationId));
    this.removeFromIndex(conversationId);
  }

  async listConversations(): Promise<string[]> {
    const raw = localStorage.getItem(this.indexKey());
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  }

  private key(conversationId: string): string {
    return `${this.prefix}:${conversationId}`;
  }

  private indexKey(): string {
    return `${this.prefix}:__index__`;
  }

  private addToIndex(conversationId: string): void {
    const ids = this.getIndex();
    if (!ids.includes(conversationId)) {
      ids.push(conversationId);
      localStorage.setItem(this.indexKey(), JSON.stringify(ids));
    }
  }

  private removeFromIndex(conversationId: string): void {
    const ids = this.getIndex().filter((id) => id !== conversationId);
    localStorage.setItem(this.indexKey(), JSON.stringify(ids));
  }

  private getIndex(): string[] {
    const raw = localStorage.getItem(this.indexKey());
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  }
}
