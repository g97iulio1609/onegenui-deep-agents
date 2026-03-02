/** Shared props and style types for @gauss-ai/react components. */

export interface GaussTheme {
  /** Primary brand color. */
  primaryColor?: string;
  /** Background color for the chat container. */
  backgroundColor?: string;
  /** User message bubble background. */
  userBubbleColor?: string;
  /** Assistant message bubble background. */
  assistantBubbleColor?: string;
  /** Text color. */
  textColor?: string;
  /** Border radius for bubbles. */
  borderRadius?: string;
  /** Font family. */
  fontFamily?: string;
}

export const defaultTheme: GaussTheme = {
  primaryColor: "#6366f1",
  backgroundColor: "#ffffff",
  userBubbleColor: "#6366f1",
  assistantBubbleColor: "#f3f4f6",
  textColor: "#111827",
  borderRadius: "12px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

/** Build CSS custom properties from a theme. */
export function themeToVars(theme: GaussTheme): Record<string, string> {
  const merged = { ...defaultTheme, ...theme };
  return {
    "--gauss-primary": merged.primaryColor!,
    "--gauss-bg": merged.backgroundColor!,
    "--gauss-user-bubble": merged.userBubbleColor!,
    "--gauss-assistant-bubble": merged.assistantBubbleColor!,
    "--gauss-text": merged.textColor!,
    "--gauss-radius": merged.borderRadius!,
    "--gauss-font": merged.fontFamily!,
  };
}
