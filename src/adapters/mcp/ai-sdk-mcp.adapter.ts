// AiSdkMcpAdapter — Adapter using @ai-sdk/mcp createMCPClient

import type {
  McpPort,
  McpToolDefinition,
  McpToolResult,
  McpServerInfo,
  McpServerConfig,
} from "../../ports/mcp.port.js";

interface MCPClient {
  tools(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

export class AiSdkMcpAdapter implements McpPort {
  private readonly clients = new Map<string, MCPClient>();
  private readonly configs = new Map<string, McpServerConfig>();

  constructor(options: { servers?: McpServerConfig[] } = {}) {
    for (const server of options.servers ?? []) {
      this.configs.set(server.id, server);
    }
  }

  async discoverTools(): Promise<Record<string, McpToolDefinition>> {
    const result: Record<string, McpToolDefinition> = {};
    for (const [serverId, client] of this.clients) {
      const tools = await client.tools();
      for (const [name, rawTool] of Object.entries(tools)) {
        const tool = rawTool as {
          description?: string;
          parameters?: Record<string, unknown>;
        };
        const namespacedName = `${serverId}:${name}`;
        result[namespacedName] = {
          name: namespacedName,
          description: tool.description ?? "",
          inputSchema: (tool.parameters ?? {}) as Record<string, unknown>,
        };
      }
    }
    return result;
  }

  async executeTool(name: string, args: unknown): Promise<McpToolResult> {
    const colonIndex = name.indexOf(":");
    const serverId = colonIndex > -1 ? name.slice(0, colonIndex) : undefined;
    const toolName = colonIndex > -1 ? name.slice(colonIndex + 1) : name;

    if (serverId) {
      const client = this.clients.get(serverId);
      if (client) {
        const tools = await client.tools();
        const toolDef = tools[toolName] as
          | { execute?: (a: unknown) => Promise<unknown> }
          | undefined;
        if (toolDef?.execute) {
          const raw = await toolDef.execute(args);
          return {
            content: [{ type: "text", text: String(raw) }],
            isError: false,
          };
        }
      }
      throw new Error(
        `Tool "${toolName}" not found on server "${serverId}"`,
      );
    }

    for (const [, client] of this.clients) {
      const tools = await client.tools();
      const toolDef = tools[toolName] as
        | { execute?: (a: unknown) => Promise<unknown> }
        | undefined;
      if (!toolDef?.execute) continue;
      const raw = await toolDef.execute(args);
      return { content: [{ type: "text", text: String(raw) }], isError: false };
    }
    throw new Error(`Tool "${name}" not found on any connected MCP server`);
  }

  async listServers(): Promise<McpServerInfo[]> {
    const infos: McpServerInfo[] = [];
    for (const [id, config] of this.configs) {
      infos.push({
        id,
        name: config.name,
        status: this.clients.has(id) ? "connected" : "disconnected",
        toolCount: 0,
        transport: config.transport === "sse" ? "sse" : config.transport,
      });
    }
    return infos;
  }

  async connect(config: McpServerConfig): Promise<void> {
    this.configs.set(config.id, config);
    if (this.clients.has(config.id)) return;
    const createClient = await loadCreateMCPClient();
    const client = await createClient(buildTransport(config));
    this.clients.set(config.id, client as MCPClient);
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;
    await client.close();
    this.clients.delete(serverId);
  }

  async closeAll(): Promise<void> {
    const ids = Array.from(this.clients.keys());
    for (const id of ids) {
      await this.disconnect(id);
    }
  }
}

async function loadCreateMCPClient(): Promise<
  (config: Record<string, unknown>) => Promise<unknown>
> {
  try {
    // @ts-expect-error — optional peer dependency, resolved at runtime
    const mod = (await import("@ai-sdk/mcp")) as {
      createMCPClient?: (c: Record<string, unknown>) => Promise<unknown>;
    };
    if (!mod.createMCPClient) {
      throw new Error("createMCPClient not found in @ai-sdk/mcp");
    }
    return mod.createMCPClient;
  } catch {
    throw new Error(
      "Failed to load @ai-sdk/mcp. Install it with: pnpm add @ai-sdk/mcp",
    );
  }
}

function buildTransport(config: McpServerConfig): Record<string, unknown> {
  if (config.transport === "stdio") {
    return {
      transport: {
        type: "stdio",
        command: config.command,
        args: config.args,
        env: config.env,
      },
    };
  }
  return {
    transport: {
      type: config.transport === "sse" ? "sse" : "http",
      url: config.url,
      headers: config.headers,
    },
  };
}
