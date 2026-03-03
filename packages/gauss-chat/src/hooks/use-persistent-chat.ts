/** Hook that wraps useChat with persistent storage. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, UseChatOptions, UseChatReturn } from "../types/index.js";
import type { ChatStorage } from "../persistence/storage.js";
import { useChat } from "./use-chat.js";

/** Options for the usePersistentChat hook. */
export interface UsePersistentChatOptions extends UseChatOptions {
  /** Storage adapter for persistence. */
  storage: ChatStorage;
  /** Unique conversation identifier. */
  conversationId: string;
}

/** Return value of usePersistentChat. */
export interface UsePersistentChatReturn extends UseChatReturn {
  /** The conversation ID. */
  conversationId: string;
  /** Delete the conversation from storage and reset chat. */
  deleteConversation: () => Promise<void>;
}

/**
 * React hook that wraps useChat and syncs messages to a storage adapter.
 *
 * Loads initial messages from storage on mount and saves after each
 * assistant response completes.
 */
export function usePersistentChat(options: UsePersistentChatOptions): UsePersistentChatReturn {
  const { storage, conversationId, onFinish, ...chatOptions } = options;

  const [storedMessages, setStoredMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const storageRef = useRef(storage);
  storageRef.current = storage;

  // Load messages from storage on mount / conversationId change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const messages = await storageRef.current.getMessages(conversationId);
      if (!cancelled) {
        setStoredMessages(messages);
        setLoaded(true);
      }
    }

    setLoaded(false);
    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleFinish = useCallback(
    (message: ChatMessage) => {
      onFinish?.(message);
    },
    [onFinish],
  );

  // Pass storedMessages as initialMessages so useChat's reset() captures them.
  // useState inside useChat ignores this after first render, so we call
  // reset() once after loading to inject the stored messages.
  const chat = useChat({
    ...chatOptions,
    initialMessages: storedMessages,
    onFinish: handleFinish,
  });

  // After storage load completes, call reset() to inject stored messages.
  // At this point useChat has re-rendered with the new initialMessages value,
  // so its reset callback (which depends on initialMessages) is up to date.
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (loaded && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      if (storedMessages.length > 0) {
        chat.reset();
      }
    }
  }, [loaded, storedMessages, chat]);

  // Reset restore flag when conversationId changes
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [conversationId]);

  // Handle pending reset (after deleteConversation clears storedMessages)
  const [pendingReset, setPendingReset] = useState(false);
  useEffect(() => {
    if (pendingReset) {
      setPendingReset(false);
      chat.reset();
    }
  }, [pendingReset, chat]);

  // Persist messages after each assistant response
  const prevMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    if (!loaded) return;
    if (chat.status !== "idle" && chat.status !== "error") return;
    if (chat.messages === prevMessagesRef.current) return;
    if (chat.messages.length === 0) return;

    prevMessagesRef.current = chat.messages;
    void storageRef.current.saveMessages(conversationId, chat.messages);
  }, [loaded, chat.messages, chat.status, conversationId]);

  const deleteConversation = useCallback(async () => {
    await storageRef.current.deleteConversation(conversationId);
    setStoredMessages([]);
    setPendingReset(true);
  }, [conversationId]);

  return {
    ...chat,
    conversationId,
    deleteConversation,
  };
}
