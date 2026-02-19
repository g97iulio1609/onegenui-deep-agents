import type { FilesystemPort } from "../../ports/filesystem.port.js";
import type { Plan } from "../../domain/plan.schema.js";

export const PLAN_PATH = "plan.json";

export async function loadPlan(fs: FilesystemPort): Promise<Plan | null> {
  const exists = await fs.exists(PLAN_PATH, "persistent");
  if (!exists) return null;
  const raw = await fs.read(PLAN_PATH, "persistent");
  return JSON.parse(raw) as Plan;
}

export async function savePlan(fs: FilesystemPort, plan: Plan): Promise<void> {
  await fs.write(PLAN_PATH, JSON.stringify(plan, null, 2), "persistent");
}
