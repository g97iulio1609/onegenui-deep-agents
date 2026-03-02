# @gauss-ai/react

Pre-built React UI components for AI chat interfaces — drop-in, themeable, accessible.

## Installation

```bash
npm install @gauss-ai/react @gauss-ai/chat
```

## Quick Start

```tsx
import { useChat } from "@gauss-ai/chat";
import { ChatPanel } from "@gauss-ai/react";

function App() {
  const { messages, sendMessage, status, stop } = useChat({
    api: "/api/chat",
  });

  return (
    <ChatPanel
      messages={messages}
      onSend={(text) => sendMessage(text)}
      status={status}
      onStop={stop}
      header={<h2>Gauss Chat</h2>}
    />
  );
}
```

## Components

### `<ChatPanel />`

Full chat interface combining MessageList, ChatInput, and StreamingIndicator.

```tsx
<ChatPanel
  messages={messages}
  onSend={(text) => sendMessage(text)}
  status={status}
  onStop={stop}
  placeholder="Ask anything..."
  theme={{ primaryColor: "#8b5cf6" }}
  header={<h2>My Chat</h2>}
  renderMessage={(msg, i) => <CustomMessage key={msg.id} message={msg} />}
/>
```

### `<MessageList />`

Scrollable message list with user/assistant bubble styling.

```tsx
<MessageList messages={messages} theme={theme} />
```

### `<ChatInput />`

Text input with send/stop buttons and keyboard shortcuts (Enter to send).

```tsx
<ChatInput
  onSend={(text) => sendMessage(text)}
  status={status}
  onStop={stop}
  placeholder="Type a message..."
/>
```

### `<StreamingIndicator />`

Animated typing indicator shown during streaming.

```tsx
<StreamingIndicator isStreaming={status === "streaming"} text="Thinking" />
```

### `<ToolCallViewer />`

Displays tool invocations and their results.

```tsx
<ToolCallViewer
  toolCalls={[{ type: "tool-call", toolName: "search", toolCallId: "tc1", args: { q: "test" } }]}
  toolResults={[{ type: "tool-result", toolCallId: "tc1", result: { data: "found" } }]}
/>
```

### `<AgentSelector />`

Dropdown for selecting between multiple agents.

```tsx
<AgentSelector
  agents={[
    { id: "code", name: "Code Reviewer" },
    { id: "general", name: "Assistant", description: "General purpose" },
  ]}
  selectedAgent={agent}
  onSelect={setAgent}
/>
```

## Theming

Customize the look with the `theme` prop:

```tsx
import { ChatPanel } from "@gauss-ai/react";
import type { GaussTheme } from "@gauss-ai/react";

const theme: GaussTheme = {
  primaryColor: "#8b5cf6",
  backgroundColor: "#0f172a",
  userBubbleColor: "#7c3aed",
  assistantBubbleColor: "#1e293b",
  textColor: "#f8fafc",
  borderRadius: "16px",
  fontFamily: "Inter, system-ui, sans-serif",
};

<ChatPanel messages={messages} onSend={onSend} theme={theme} />;
```

## Data Test IDs

All components expose `data-testid` attributes for easy E2E testing:

- `gauss-chat-panel`
- `gauss-message-list`
- `gauss-message-user` / `gauss-message-assistant`
- `gauss-chat-input`
- `gauss-chat-textarea`
- `gauss-send-button` / `gauss-stop-button`
- `gauss-streaming-indicator`
- `gauss-tool-call-viewer` / `gauss-tool-calls` / `gauss-tool-result`
- `gauss-agent-selector`
- `gauss-chat-header`

## License

MIT
