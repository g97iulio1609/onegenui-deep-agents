// =============================================================================
// Glob pattern matching utility (no external deps)
// =============================================================================

const regexCache = new Map<string, RegExp>();
const MAX_CACHE_SIZE = 500;

/** Convert a glob pattern to a RegExp. Supports *, **, and ? wildcards. */
export function globToRegex(pattern: string): RegExp {
  const cached = regexCache.get(pattern);
  if (cached) return cached;

  let result = "";
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i]!;
    if (char === "*" && pattern[i + 1] === "*") {
      result += ".*";
      i += pattern[i + 2] === "/" ? 3 : 2;
    } else if (char === "*") {
      result += "[^/]*";
      i++;
    } else if (char === "?") {
      result += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(char)) {
      result += "\\" + char;
      i++;
    } else {
      result += char;
      i++;
    }
  }
  const regex = new RegExp("^" + result + "$");
  if (regexCache.size >= MAX_CACHE_SIZE) {
    const oldest = regexCache.keys().next().value as string;
    regexCache.delete(oldest);
  }
  regexCache.set(pattern, regex);
  return regex;
}
