import type {
  OutputSchema,
  ParseResult,
  ValidationError,
} from "../../../ports/structured-output.port.js";

function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");
}

function isSeparatorRow(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]+$/.test(line.trim());
}

export function parseMarkdownTable<T>(
  raw: string,
  schema: OutputSchema<T>,
): ParseResult<T> {
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const errors: ValidationError[] = [];

  // Find header row (first row with pipes)
  const headerIdx = lines.findIndex((l) => l.includes("|"));
  if (headerIdx === -1) {
    errors.push({ path: "$", message: "No markdown table found" });
    return { success: false, raw, errors };
  }

  const headers = parseTableRow(lines[headerIdx]);

  // Skip separator row
  const dataStart =
    headerIdx + 1 < lines.length && isSeparatorRow(lines[headerIdx + 1])
      ? headerIdx + 2
      : headerIdx + 1;

  const rows: Record<string, string>[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    if (isSeparatorRow(lines[i])) continue;
    if (!lines[i].includes("|")) continue;

    const values = parseTableRow(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    errors.push({ path: "$", message: "No data rows found in markdown table" });
    return { success: false, raw, errors };
  }

  return { success: true, data: rows as T, raw };
}
