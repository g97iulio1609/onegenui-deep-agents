import React, { createContext, useContext } from "react";

/** Configuration provided to all agent hooks via context. */
export interface AgentProviderConfig {
  /** Default API endpoint for agent hooks. */
  api?: string;
  /** Default headers for all requests. */
  headers?: Record<string, string>;
  /** Default agent ID. */
  agentId?: string;
  /** Enable memory by default. */
  enableMemory?: boolean;
}

/** React context for agent configuration. */
export const AgentContext = createContext<AgentProviderConfig>({});

/** Props for the AgentProvider component. */
export interface AgentProviderProps {
  children: React.ReactNode;
  config: AgentProviderConfig;
}

/**
 * Provides default agent configuration to all child hooks.
 *
 * @example
 * ```tsx
 * <AgentProvider config={{ api: "/api/agent", agentId: "assistant" }}>
 *   <ChatUI />
 * </AgentProvider>
 * ```
 */
export function AgentProvider({ children, config }: AgentProviderProps): React.JSX.Element {
  return React.createElement(AgentContext.Provider, { value: config }, children);
}

/**
 * Hook to access agent provider configuration.
 */
export function useAgentConfig(): AgentProviderConfig {
  return useContext(AgentContext);
}
