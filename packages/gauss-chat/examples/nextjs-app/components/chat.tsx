"use client";

import { useChat } from "@gauss-ai/chat";
import { ChatPanel } from "@gauss-ai/react";

export function Chat() {
  const { messages, sendMessage, status, stop } = useChat({
    api: "/api/chat",
  });

  return (
    <div style={{ height: "100vh" }}>
      <ChatPanel
        messages={messages}
        onSend={(text) => sendMessage(text)}
        status={status}
        onStop={stop}
        header={<h2 style={{ margin: 0, padding: "4px 0" }}>Gauss Chat</h2>}
        theme={{ primaryColor: "#6366f1" }}
      />
    </div>
  );
}
