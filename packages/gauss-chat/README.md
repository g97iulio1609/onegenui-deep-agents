# @gauss-ai/chat

React hooks for building AI chat interfaces with Gauss — plug-and-play, streaming-first, type-safe.

## Installation

```bash
npm install @gauss-ai/chat
```

## Quick Start

```tsx
import { useChat } from "@gauss-ai/chat";

function Chat() {
  const { messages, sendMessage, status, stop } = useChat({
    api: "/api/chat",
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong>
          {m.parts
            .filter((p) => p.type === "text")
            .map((p, i) => (
              <span key={i}>{p.text}</span>
            ))}
        </div>
      ))}
      <input
        type="text"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
      />
      {status === "streaming" && <button onClick={stop}>Stop</button>}
    </div>
  );
}
```

## Hooks

### `useChat`

Full-featured chat hook with streaming, tool calls, and multi-turn conversations.

```tsx
const {
  messages,    // ChatMessage[]
  sendMessage, // (text: string) => Promise<void>
  status,      // "idle" | "loading" | "streaming" | "error"
  error,       // Error | null
  stop,        // () => void
  reset,       // () => void
  isLoading,   // boolean
} = useChat({
  api: "/api/chat",           // API endpoint
  initialMessages: [],        // Pre-populate messages
  systemPrompt: "You are...", // System prompt
  headers: {},                // Custom headers
  body: {},                   // Extra body data
  transport: new GaussTransport(), // Custom transport
  onError: (err) => {},       // Error callback
  onFinish: (msg) => {},      // Finish callback
});
```

### `useCompletion`

Single-turn completion with streaming.

```tsx
const {
  completion, // string
  complete,   // (prompt: string) => Promise<void>
  status,
  error,
  stop,
  isLoading,
} = useCompletion({ api: "/api/completion" });
```

### `useAgent`

Agent-specific hook with memory and multi-agent support.

```tsx
const {
  messages,
  sendMessage,
  agent,    // string | undefined
  setAgent, // (agentId: string) => void
  sessionId,
  ...chatReturn,
} = useAgent({
  api: "/api/agent",
  agent: "code-reviewer",
  enableMemory: true,
  sessionId: "sess-123",
});
```

## Server Utilities

```tsx
import { GaussStream, toNextResponse, pipeTextStream } from "@gauss-ai/chat/server";

// Next.js App Router
export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = new GaussStream();

  // Pipe your agent's output
  stream.writeText("Hello ");
  stream.writeText("World!");
  stream.close();

  return toNextResponse(stream);
}
```

## Custom Transport

```tsx
import { GaussTransport } from "@gauss-ai/chat";

const transport = new GaussTransport({
  api: "/api/chat",
  headers: { Authorization: "Bearer ..." },
  body: { model: "gpt-4" },
});

const { messages, sendMessage } = useChat({ transport });
```

## Types

All types are fully exported:

```ts
import type {
  ChatMessage,
  MessagePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  StreamEvent,
  ChatStatus,
  UseChatOptions,
  UseChatReturn,
} from "@gauss-ai/chat";
```

## License

MIT
