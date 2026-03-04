/**
 * GaussNextProvider — SSR-aware context provider for Next.js.
 *
 * Provides default configuration (API endpoint, headers, theme) to all
 * Gauss components in the tree. Handles SSR hydration safely.
 */

"use client";

import React, { createContext, useContext, useMemo } from "react";

/** Theme configuration (matches @gauss-ai/react GaussTheme). */
export interface GaussNextTheme {
  /** Primary brand color. */
  primary?: string;
  /** Background color. */
  background?: string;
  /** Text color. */
  text?: string;
  /** Border radius. */
  radius?: string;
  /** Font family. */
  font?: string;
}

/** Configuration for GaussNextProvider. */
export interface GaussNextConfig {
  /** Default API endpoint. */
  api?: string;
  /** Default headers for all requests. */
  headers?: Record<string, string>;
  /** Default extra body data. */
  body?: Record<string, unknown>;
  /** Default theme. */
  theme?: GaussNextTheme;
  /** Request credentials mode. */
  credentials?: RequestCredentials;
  /** Base path prefix (useful for mounted apps). */
  basePath?: string;
}

/** Props for GaussNextProvider. */
export interface GaussNextProviderProps {
  /** Configuration values. */
  config: GaussNextConfig;
  /** Child components. */
  children: React.ReactNode;
}

const defaultConfig: GaussNextConfig = {
  api: "/api/chat",
};

const GaussNextContext = createContext<GaussNextConfig>(defaultConfig);

/**
 * Provides Gauss configuration to the component tree.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { GaussNextProvider } from "@gauss-ai/next";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <GaussNextProvider config={{ api: "/api/chat", basePath: "/app" }}>
 *       {children}
 *     </GaussNextProvider>
 *   );
 * }
 * ```
 */
export function GaussNextProvider({
  config,
  children,
}: GaussNextProviderProps): React.JSX.Element {
  const merged = useMemo(
    () => ({ ...defaultConfig, ...config }),
    [config],
  );

  return (
    <GaussNextContext.Provider value={merged}>
      {children}
    </GaussNextContext.Provider>
  );
}

/**
 * Access Gauss configuration from the nearest GaussNextProvider.
 *
 * Falls back to sensible defaults if no provider exists.
 */
export function useGaussNext(): GaussNextConfig {
  return useContext(GaussNextContext);
}
