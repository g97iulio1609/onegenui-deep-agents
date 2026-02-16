// =============================================================================
// CLI Format — ANSI color helpers (zero dependencies)
// =============================================================================

const CODES: Record<string, string> = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

export function color(name: keyof typeof CODES, text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${CODES[name]}${text}${CODES.reset}`;
}

export function bold(text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${CODES.bold}${text}${CODES.reset}`;
}

// Spinner for "thinking" indicator
export function createSpinner(text: string): { stop: (finalText?: string) => void } {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${text}...\n`);
    return { stop: () => {} };
  }
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${CODES.cyan}${frames[i++ % frames.length]} ${text}${CODES.reset}`);
  }, 80);
  return {
    stop(finalText?: string) {
      clearInterval(timer);
      process.stdout.write(`\r${" ".repeat(text.length + 4)}\r`);
      if (finalText) process.stdout.write(finalText);
    },
  };
}

// Mask API key for display — shared masking logic
export function maskKey(key: string): string {
  if (key.length <= 12) return key.slice(0, 4) + "****";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

// Format elapsed time
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const CODE_BLOCK_RE = /```(\w*)\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const HEADER_RE = /^(#{1,3})\s+(.+)$/gm;

// Simple markdown formatting for terminal output
export function formatMarkdown(text: string): string {
  return text
    // Code blocks
    .replace(CODE_BLOCK_RE, (_match, lang: string, code: string) => {
      const header = lang ? color("dim", `  ─── ${lang} ───`) : "";
      return `${header}\n${color("cyan", code.trimEnd())}\n${color("dim", "  ─────────")}`;
    })
    // Inline code
    .replace(INLINE_CODE_RE, (_match, code: string) => color("cyan", code))
    // Bold
    .replace(BOLD_RE, (_match, text: string) => bold(text))
    // Headers
    .replace(HEADER_RE, (_match, _hashes: string, text: string) =>
      bold(color("yellow", text)),
    );
}

// Box drawing for nice output
export function box(title: string, content: string): string {
  const lines = content.split("\n");
  const maxLen = Math.max(title.length, ...lines.map(l => l.length));
  const hr = "─".repeat(maxLen + 2);
  const top = `┌${hr}┐`;
  const bottom = `└${hr}┘`;
  const titleLine = `│ ${title.padEnd(maxLen)} │`;
  const sep = `├${hr}┤`;
  const body = lines.map(l => `│ ${l.padEnd(maxLen)} │`).join("\n");
  return `${top}\n${titleLine}\n${sep}\n${body}\n${bottom}`;
}
