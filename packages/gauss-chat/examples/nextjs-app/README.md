# Next.js + @gauss-ai/chat + @gauss-ai/react Example

A minimal Next.js 15 app demonstrating how to build a chat interface with Gauss.

## Setup

```bash
# Install dependencies
npm install @gauss-ai/chat @gauss-ai/react gauss-ts

# Set your API key
export GAUSS_API_KEY=your-key-here

# Run the dev server
npm run dev
```

## Structure

```
app/
  api/chat/route.ts   — Server-side streaming endpoint
  page.tsx            — Client-side chat UI
components/
  chat.tsx            — Chat component using hooks + UI
```

## How It Works

### Server (API Route)

```ts
// app/api/chat/route.ts
import { GaussStream, toNextResponse, pipeTextStream } from "@gauss-ai/chat/server";
import { Agent } from "gauss-ts";

export async function POST(req: Request) {
  const { messages, agent: agentName } = await req.json();

  const agent = new Agent({ name: agentName ?? "assistant" });
  const stream = new GaussStream();

  // Get the last user message
  const lastMessage = messages.at(-1);
  const prompt = lastMessage?.parts
    ?.filter((p: { type: string }) => p.type === "text")
    .map((p: { text: string }) => p.text)
    .join("") ?? "";

  // Pipe agent output to SSE stream
  const agentStream = agent.streamGenerate(prompt);
  pipeTextStream(agentStream, stream);

  return toNextResponse(stream);
}
```

### Client (Chat Component)

```tsx
// components/chat.tsx
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
        header={<h2 style={{ margin: 0 }}>Gauss Chat</h2>}
        theme={{ primaryColor: "#6366f1" }}
      />
    </div>
  );
}
```

### Page

```tsx
// app/page.tsx
import { Chat } from "../components/chat";

export default function Home() {
  return <Chat />;
}
```

## With Agent Selection

```tsx
"use client";

import { useAgent } from "@gauss-ai/chat";
import { ChatPanel, AgentSelector } from "@gauss-ai/react";

const agents = [
  { id: "assistant", name: "General Assistant" },
  { id: "code-reviewer", name: "Code Reviewer" },
  { id: "writer", name: "Content Writer" },
];

export function AgentChat() {
  const { messages, sendMessage, status, stop, agent, setAgent } = useAgent({
    api: "/api/chat",
    agent: "assistant",
    enableMemory: true,
  });

  return (
    <div style={{ height: "100vh" }}>
      <ChatPanel
        messages={messages}
        onSend={(text) => sendMessage(text)}
        status={status}
        onStop={stop}
        header={
          <AgentSelector
            agents={agents}
            selectedAgent={agent}
            onSelect={setAgent}
          />
        }
      />
    </div>
  );
}
```

## With Custom Transport

```tsx
import { useChat, GaussTransport } from "@gauss-ai/chat";

const transport = new GaussTransport({
  api: "https://api.example.com/chat",
  headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
  body: { model: "gpt-4" },
});

function Chat() {
  const { messages, sendMessage } = useChat({ transport });
  // ...
}
```
