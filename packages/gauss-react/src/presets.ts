/**
 * Pre-built theme presets for @gauss-ai/react.
 *
 * Import any preset and pass it as the `theme` prop to GaussChat,
 * GaussChatWindow, ChatPanel, or any themed component.
 *
 * @example
 * ```tsx
 * import { GaussChat } from "@gauss-ai/react";
 * import { darkTheme } from "@gauss-ai/react";
 *
 * <GaussChat api="/api/chat" theme={darkTheme} />
 * ```
 */
import type { GaussTheme } from "./theme.js";

/** Light theme — the default. Clean, neutral palette. */
export const lightTheme: GaussTheme = {
  primaryColor: "#6366f1",
  backgroundColor: "#ffffff",
  userBubbleColor: "#6366f1",
  assistantBubbleColor: "#f3f4f6",
  textColor: "#111827",
  borderRadius: "12px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

/** Dark theme — deep gray background with soft contrasts. */
export const darkTheme: GaussTheme = {
  primaryColor: "#818cf8",
  backgroundColor: "#111827",
  userBubbleColor: "#4f46e5",
  assistantBubbleColor: "#1f2937",
  textColor: "#f9fafb",
  borderRadius: "12px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

/** Minimal theme — monochrome, no color distractions. */
export const minimalTheme: GaussTheme = {
  primaryColor: "#171717",
  backgroundColor: "#fafafa",
  userBubbleColor: "#171717",
  assistantBubbleColor: "#f5f5f5",
  textColor: "#171717",
  borderRadius: "8px",
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

/** Glass theme — frosted glass with translucent elements. */
export const glassTheme: GaussTheme = {
  primaryColor: "#8b5cf6",
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  userBubbleColor: "rgba(139, 92, 246, 0.85)",
  assistantBubbleColor: "rgba(255, 255, 255, 0.12)",
  textColor: "#f1f5f9",
  borderRadius: "16px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

/** All built-in presets keyed by name. */
export const themePresets = {
  light: lightTheme,
  dark: darkTheme,
  minimal: minimalTheme,
  glass: glassTheme,
} as const;

export type ThemePresetName = keyof typeof themePresets;
