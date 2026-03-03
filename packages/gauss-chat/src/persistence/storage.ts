/** Storage adapter interfaces for chat persistence. */

import type { ChatMessage } from "../types/index.js";

/** Storage adapter interface for chat persistence. */
export interface ChatStorage {
  /** Get messages for a conversation. */
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  /** Save messages for a conversation. */
  saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void>;
  /** Delete a conversation. */
  deleteConversation(conversationId: string): Promise<void>;
  /** List all conversation IDs. */
  listConversations(): Promise<string[]>;
}
