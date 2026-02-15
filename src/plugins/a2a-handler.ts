// =============================================================================
// A2A Handler — JSON-RPC request router for tasks + discovery
// =============================================================================

export interface A2AJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface A2AJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface A2AJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: A2AJsonRpcError;
}

export type A2ATaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface A2ATask {
  id: string;
  status: A2ATaskStatus;
  prompt: string;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface A2ATasksSendParams {
  prompt: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface A2ATaskEvent {
  type: 'task:queued' | 'task:running' | 'task:completed' | 'task:failed' | 'task:cancelled';
  taskId: string;
  task: A2ATask;
  timestamp: string;
}

export type TaskEventListener = (event: A2ATaskEvent) => void;

export interface A2ARequestHandlers {
  sendTask(params: A2ATasksSendParams): Promise<A2ATask>;
  getTask(taskId: string): Promise<A2ATask | null>;
  listTasks?(): Promise<A2ATask[]>;
  cancelTask?(taskId: string): Promise<A2ATask | null>;
  getAgentCard?(): Promise<unknown>;
  sendTaskSubscribe?(params: A2ATasksSendParams): AsyncIterable<A2ATaskEvent>;
}

function createError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): A2AJsonRpcResponse {
  const error: A2AJsonRpcError = data === undefined
    ? { code, message }
    : { code, message, data };

  return {
    jsonrpc: "2.0",
    id,
    error,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createA2AJsonRpcHandler(
  handlers: A2ARequestHandlers,
): (request: A2AJsonRpcRequest) => Promise<A2AJsonRpcResponse> {
  return async (request: A2AJsonRpcRequest): Promise<A2AJsonRpcResponse> => {
    const id = request.id ?? null;

    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      return createError(id, -32600, "Invalid Request");
    }

    try {
      switch (request.method) {
        case "tasks/send": {
          const params = asRecord(request.params);
          if (!params) {
            return createError(id, -32602, "Invalid params: expected object");
          }

          const prompt = asString(params.prompt);
          if (!prompt) {
            return createError(id, -32602, "Invalid params: prompt is required");
          }

          const parsedTaskId = params.taskId === undefined ? undefined : asString(params.taskId);
          if (params.taskId !== undefined && !parsedTaskId) {
            return createError(id, -32602, "Invalid params: taskId must be a non-empty string");
          }
          const taskId = parsedTaskId ?? undefined;

          const metadata = params.metadata === undefined ? undefined : asRecord(params.metadata);
          if (params.metadata !== undefined && !metadata) {
            return createError(id, -32602, "Invalid params: metadata must be an object");
          }

          const task = await handlers.sendTask({ prompt, taskId, metadata: metadata ?? undefined });
          return {
            jsonrpc: "2.0",
            id,
            result: task,
          };
        }

        case "tasks/get": {
          const params = asRecord(request.params);
          if (!params) {
            return createError(id, -32602, "Invalid params: expected object");
          }

          const taskId = asString(params.taskId);
          if (!taskId) {
            return createError(id, -32602, "Invalid params: taskId is required");
          }

          const task = await handlers.getTask(taskId);
          if (!task) {
            return createError(id, -32004, "Task not found", { taskId });
          }

          return {
            jsonrpc: "2.0",
            id,
            result: task,
          };
        }

        case "tasks/list": {
          if (!handlers.listTasks) {
            return createError(id, -32601, "Method not found: tasks/list");
          }

          const tasks = await handlers.listTasks();
          return {
            jsonrpc: "2.0",
            id,
            result: { tasks },
          };
        }

        case "tasks/cancel": {
          if (!handlers.cancelTask) {
            return createError(id, -32601, "Method not found: tasks/cancel");
          }

          const params = asRecord(request.params);
          if (!params) {
            return createError(id, -32602, "Invalid params: expected object");
          }

          const taskId = asString(params.taskId);
          if (!taskId) {
            return createError(id, -32602, "Invalid params: taskId is required");
          }

          const task = await handlers.cancelTask(taskId);
          if (!task) {
            return createError(id, -32004, "Task not found", { taskId });
          }

          return {
            jsonrpc: "2.0",
            id,
            result: task,
          };
        }

        case "agent/card": {
          if (!handlers.getAgentCard) {
            return createError(id, -32601, "Method not found: agent/card");
          }

          const card = await handlers.getAgentCard();
          return {
            jsonrpc: "2.0",
            id,
            result: card,
          };
        }

        case "tasks/sendSubscribe": {
          if (!handlers.sendTaskSubscribe) {
            return createError(id, -32601, "Method not found: tasks/sendSubscribe");
          }

          const params = asRecord(request.params);
          if (!params) {
            return createError(id, -32602, "Invalid params: expected object");
          }

          const prompt = asString(params.prompt);
          if (!prompt) {
            return createError(id, -32602, "Invalid params: prompt is required");
          }

          const parsedTaskId = params.taskId === undefined ? undefined : asString(params.taskId);
          if (params.taskId !== undefined && !parsedTaskId) {
            return createError(id, -32602, "Invalid params: taskId must be a non-empty string");
          }
          const taskId = parsedTaskId ?? undefined;

          const metadata = params.metadata === undefined ? undefined : asRecord(params.metadata);
          if (params.metadata !== undefined && !metadata) {
            return createError(id, -32602, "Invalid params: metadata must be an object");
          }

          // tasks/sendSubscribe is handled via SSE HTTP endpoint, not JSON-RPC
          return createError(id, -32601, "Use SSE endpoint for tasks/sendSubscribe");
        }

        case "health": {
          return {
            jsonrpc: "2.0",
            id,
            result: { ok: true },
          };
        }

        default:
          return createError(id, -32601, `Method not found: ${request.method}`);
      }
    } catch (error) {
      return createError(
        id,
        -32603,
        error instanceof Error ? error.message : "Internal error",
      );
    }
  };
}

export function createA2AHttpHandler(
  jsonRpcHandler: (request: A2AJsonRpcRequest) => Promise<A2AJsonRpcResponse>,
  sseHandlers?: {
    sendTaskSubscribe?: (params: A2ATasksSendParams) => AsyncIterable<A2ATaskEvent>;
  }
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    
    // Handle agent discovery endpoint
    if (request.method === "GET" && url.pathname === "/.well-known/agent.json") {
      try {
        const cardResponse = await jsonRpcHandler({
          jsonrpc: "2.0",
          id: "agent-discovery",
          method: "agent/card"
        });
        
        if (cardResponse.error) {
          return new Response(
            JSON.stringify({ error: "Agent card not available" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const agentCard = cardResponse.result as any;
        // Support both AgentCardSnapshot (agentsMd/skillsMd) and plain card (name/instructions/tools)
        const cardName = agentCard?.name ?? agentCard?.source?.name ?? "Agent";
        const cardDescription = agentCard?.instructions ?? agentCard?.agentsMd ?? "A2A-compatible agent";
        const cardTools: string[] = agentCard?.tools ?? [];
        const cardSkills: string[] = agentCard?.skillsMd 
          ? agentCard.skillsMd.split('\n').filter((l: string) => l.startsWith('- ')).map((l: string) => l.slice(2))
          : [];
        const allSkills = cardTools.length > 0 ? cardTools : cardSkills;

        const discoveryCard = {
          name: cardName,
          description: cardDescription,
          url: url.origin + "/a2a",
          version: "1.0.0",
          capabilities: {
            streaming: true,
            pushNotifications: true
          },
          skills: allSkills.map((skill: string, index: number) => ({
            id: `skill-${index}`,
            name: skill,
            description: `Skill: ${skill}`
          })),
          authentication: { schemes: ["none"] }
        };

        return new Response(JSON.stringify(discoveryCard), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Failed to generate agent card" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Parse body once for POST requests
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return new Response(
        JSON.stringify(createError(null, -32700, "Parse error")),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Handle SSE subscription endpoint
    if (sseHandlers?.sendTaskSubscribe) {
      const requestObject = asRecord(parsed);
      if (requestObject?.method === "tasks/sendSubscribe") {
        const params = asRecord(requestObject.params);
        if (!params) {
          return new Response("Invalid params", { status: 400 });
        }

        const prompt = asString(params.prompt);
        if (!prompt) {
          return new Response("Prompt required", { status: 400 });
        }

        const taskId = params.taskId ? asString(params.taskId) : undefined;
        const metadata = params.metadata ? asRecord(params.metadata) : undefined;

        const eventStream = sseHandlers.sendTaskSubscribe({
          prompt,
          taskId: taskId ?? undefined,
          metadata: metadata ?? undefined
        });

        return createSseResponse(eventStream);
      }
    }

    if (Array.isArray(parsed)) {
      return new Response(
        JSON.stringify(createError(null, -32600, "Batch requests are not supported")),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const requestObject = asRecord(parsed);
    if (!requestObject) {
      return new Response(
        JSON.stringify(createError(null, -32600, "Invalid Request")),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // JSON-RPC notification: request without an id field
    const hasId = 'id' in requestObject;

    const normalizedRequest: A2AJsonRpcRequest = {
      jsonrpc: requestObject.jsonrpc as "2.0",
      id: hasId ? (requestObject.id as string | number | null) ?? null : null,
      method: requestObject.method as string,
      params: requestObject.params,
    };

    if (!hasId) {
      await jsonRpcHandler({ ...normalizedRequest, id: null });
      return new Response(null, { status: 202 });
    }

    const response = await jsonRpcHandler(normalizedRequest);
    return new Response(
      JSON.stringify(response),
      {
        status: response.error ? 400 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
}

function createSseResponse(eventStream: AsyncIterable<A2ATaskEvent>): Response {
  const encoder = new TextEncoder();
  
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of eventStream) {
          const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }
        controller.close();
      } catch (error) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    }
  });

  return new Response(readableStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function createA2ASseHandler(
  handlers: Pick<A2ARequestHandlers, 'sendTaskSubscribe'>
): (params: A2ATasksSendParams) => AsyncIterable<A2ATaskEvent> {
  return (params: A2ATasksSendParams) => {
    if (!handlers.sendTaskSubscribe) {
      throw new Error("sendTaskSubscribe handler not available");
    }
    return handlers.sendTaskSubscribe(params);
  };
}
