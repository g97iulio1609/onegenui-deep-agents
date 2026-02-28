import type {
  OutputSchema,
  ParseResult,
  ValidationError,
} from "../../../ports/structured-output.port.js";

function extractCsvBlock(raw: string): string {
  const fenceMatch = raw.match(/```(?:csv)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

export function parseCsv<T>(
  raw: string,
  schema: OutputSchema<T>,
): ParseResult<T> {
  const block = extractCsvBlock(raw);
  const lines = block.split("\n").filter((l) => l.trim() !== "");
  const errors: ValidationError[] = [];

  if (lines.length < 2) {
    errors.push({
      path: "$",
      message: "CSV must contain a header row and at least one data row",
    });
    return { success: false, raw, errors };
  }

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { success: true, data: rows as T, raw };
}
