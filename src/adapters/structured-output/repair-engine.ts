import type {
  OutputSchema,
  RepairAction,
  RepairResult,
  ValidationError,
} from "../../ports/structured-output.port.js";

/** Remove trailing commas before closing braces/brackets */
function fixTrailingCommas(input: string): { output: string; fixed: boolean } {
  const result = input.replace(/,\s*([}\]])/g, "$1");
  return { output: result, fixed: result !== input };
}

/** Replace single quotes with double quotes (outside of double-quoted strings) */
function fixSingleQuotes(input: string): { output: string; fixed: boolean } {
  let result = "";
  let inDouble = false;
  let escape = false;
  let fixed = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inDouble = !inDouble;
      result += ch;
      continue;
    }

    if (ch === "'" && !inDouble) {
      result += '"';
      fixed = true;
      continue;
    }

    result += ch;
  }

  return { output: result, fixed };
}

/** Add quotes to unquoted keys: { foo: "bar" } → { "foo": "bar" } */
function fixUnquotedKeys(input: string): { output: string; fixed: boolean } {
  const result = input.replace(
    /([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g,
    '$1"$2":',
  );
  return { output: result, fixed: result !== input };
}

/** Close missing braces/brackets */
function fixMissingClose(input: string): { output: string; fixed: boolean } {
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of input) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  let result = input;
  const fixed = braces > 0 || brackets > 0;

  for (let i = 0; i < brackets; i++) result += "]";
  for (let i = 0; i < braces; i++) result += "}";

  return { output: result, fixed };
}

/** Fix truncated strings (unterminated quote) */
function fixTruncatedStrings(input: string): {
  output: string;
  fixed: boolean;
} {
  let inString = false;
  let escape = false;
  let lastQuoteIdx = -1;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      lastQuoteIdx = i;
    }
  }

  if (inString && lastQuoteIdx >= 0) {
    return { output: input + '"', fixed: true };
  }

  return { output: input, fixed: false };
}

/** Replace NaN/Infinity/undefined with null */
function fixSpecialValues(input: string): { output: string; fixed: boolean } {
  const result = input
    .replace(/:\s*NaN\b/g, ": null")
    .replace(/:\s*Infinity\b/g, ": null")
    .replace(/:\s*-Infinity\b/g, ": null")
    .replace(/:\s*undefined\b/g, ": null");
  return { output: result, fixed: result !== input };
}

export function repairJson<T>(
  raw: string,
  schema: OutputSchema<T>,
  _errors: ValidationError[],
): RepairResult<T> {
  const repairs: RepairAction[] = [];
  let current = raw.trim();

  // Extract JSON from markdown fences if present
  const fenceMatch = current.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) current = fenceMatch[1].trim();

  // Try to find JSON start if surrounded by text
  const braceStart = current.indexOf("{");
  const bracketStart = current.indexOf("[");
  if (braceStart > 0 && (bracketStart === -1 || braceStart < bracketStart)) {
    current = current.slice(braceStart);
  } else if (bracketStart > 0 && (braceStart === -1 || bracketStart < braceStart)) {
    current = current.slice(bracketStart);
  }

  // Apply repair pipeline
  const steps: Array<{
    fn: (s: string) => { output: string; fixed: boolean };
    type: RepairAction["type"];
    description: string;
  }> = [
    {
      fn: fixSpecialValues,
      type: "fix_encoding",
      description: "Replaced NaN/Infinity/undefined with null",
    },
    {
      fn: fixSingleQuotes,
      type: "fix_json",
      description: "Replaced single quotes with double quotes",
    },
    {
      fn: fixUnquotedKeys,
      type: "fix_json",
      description: "Added quotes to unquoted keys",
    },
    {
      fn: fixTrailingCommas,
      type: "fix_json",
      description: "Removed trailing commas",
    },
    {
      fn: fixTruncatedStrings,
      type: "fix_json",
      description: "Closed truncated string",
    },
    {
      fn: fixMissingClose,
      type: "fix_json",
      description: "Added missing closing braces/brackets",
    },
  ];

  for (const step of steps) {
    const { output, fixed } = step.fn(current);
    if (fixed) {
      repairs.push({ type: step.type, description: step.description });
      current = output;
    }
  }

  try {
    const parsed = JSON.parse(current) as T;
    return { success: true, data: parsed, repaired: current, repairs };
  } catch {
    return { success: false, repaired: current, repairs };
  }
}
