import React, { createContext, useContext, useMemo } from "react";
import type { GaussTheme } from "../theme.js";

export interface GaussConfig {
  /** Default API endpoint for all chat hooks. */
  api?: string;
  /** Default headers sent with every request. */
  headers?: Record<string, string>;
  /** Default theme applied to all Gauss components. */
  theme?: GaussTheme;
  /** Default extra body data. */
  body?: Record<string, unknown>;
  /** Credentials policy. */
  credentials?: RequestCredentials;
}

const GaussContext = createContext<GaussConfig>({});

/**
 * Hook to access the Gauss global configuration.
 *
 * Must be used within a `<GaussProvider>`.
 */
export function useGaussConfig(): GaussConfig {
  return useContext(GaussContext);
}

export interface GaussProviderProps {
  /** Global configuration for all Gauss components. */
  config: GaussConfig;
  children: React.ReactNode;
}

/**
 * Provider component for global Gauss configuration.
 *
 * Wrap your app (or a subtree) to set defaults for API endpoint,
 * headers, theme, and other options shared by all Gauss hooks and components.
 *
 * @example
 * ```tsx
 * import { GaussProvider, GaussChat } from "@gauss-ai/react";
 * import { darkTheme } from "@gauss-ai/react";
 *
 * function App() {
 *   return (
 *     <GaussProvider config={{
 *       api: "/api/chat",
 *       headers: { "X-API-Key": "sk-..." },
 *       theme: darkTheme,
 *     }}>
 *       <GaussChat />
 *     </GaussProvider>
 *   );
 * }
 * ```
 */
export function GaussProvider({ config, children }: GaussProviderProps): React.JSX.Element {
  const value = useMemo(() => config, [config]);
  return <GaussContext.Provider value={value}>{children}</GaussContext.Provider>;
}
