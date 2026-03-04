/**
 * Utility: merge class names (filters out falsy values).
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
