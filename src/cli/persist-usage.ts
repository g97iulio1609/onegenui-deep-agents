// =============================================================================
// persistUsage — Append session cost data to ~/.gaussflow/usage.json
// =============================================================================

import type { CostTrackerPort } from "../ports/cost-tracker.port.js";

export async function persistUsage(tracker: CostTrackerPort): Promise<void> {
  const { writeFileSync, readFileSync, existsSync, mkdirSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");

  const dir = join(homedir(), ".gaussflow");
  const filePath = join(dir, "usage.json");

  const newRecords: unknown[] = JSON.parse(tracker.exportUsage());
  if (newRecords.length === 0) return;

  let existing: unknown[] = [];
  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf-8"));
      if (Array.isArray(raw)) existing = raw;
    } catch {
      // Corrupted file — overwrite
    }
  } else {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify([...existing, ...newRecords], null, 2));
}
