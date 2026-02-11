// =============================================================================
// Glob pattern matching utility (no external deps)
// =============================================================================

/** Convert a glob pattern to a RegExp. Supports *, **, and ? wildcards. */
export function globToRegex(pattern: string): RegExp {
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
  return new RegExp("^" + result + "$");
}
