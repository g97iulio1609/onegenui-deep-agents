// =============================================================================
// Plan Schema — Piano gerarchico strutturato per task decomposition avanzata
//
// Gerarchia: Plan → Phase → Step → SubStep (N livelli ricorsivi)
// Supporta: esecuzione sequenziale, parallela, condizionale e loop
// Ogni step ha contratti input/output Zod, risorse, e stato osservabile
// =============================================================================

import { z } from "zod";

// =============================================================================
// Enums & Primitivi
// =============================================================================

/** Modalità di esecuzione di uno step */
export const StepExecutionModeSchema = z.enum([
  "sequential",
  "parallel",
  "conditional",
  "loop",
]);
export type StepExecutionMode = z.infer<typeof StepExecutionModeSchema>;

/** Macchina a stati per lo step: idle → running → completed/failed/skipped */
export const StepStatusSchema = z.enum([
  "idle",
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "blocked",
  "cancelled",
]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

/** Priorità dello step */
export const StepPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export type StepPriority = z.infer<typeof StepPrioritySchema>;

/** Stato globale del piano */
export const PlanStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

// =============================================================================
// Transizioni di stato valide (state machine)
// =============================================================================

export const STEP_STATUS_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  idle: ["pending", "skipped", "cancelled"],
  pending: ["running", "blocked", "skipped", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["pending"], // retry
  skipped: [],
  blocked: ["pending", "cancelled"],
  cancelled: [],
};

export const PLAN_STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "failed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  failed: ["active"], // retry
  cancelled: [],
};

// =============================================================================
// Resource Requirements — Budget e limiti per step
// =============================================================================

export const ResourceRequirementsSchema = z.object({
  /** Budget massimo di token (input + output) per questo step */
  maxTokenBudget: z.number().positive().optional(),
  /** Timeout in millisecondi */
  timeoutMs: z.number().positive().optional(),
  /** Numero massimo di retry in caso di fallimento */
  maxRetries: z.number().int().min(0).optional().default(0),
  /** Modello preferito (override del default del piano) */
  preferredModel: z.string().optional(),
  /** Livello di concorrenza massimo per sotto-step paralleli */
  maxConcurrency: z.number().int().positive().optional().default(5),
});
export type ResourceRequirements = z.infer<typeof ResourceRequirementsSchema>;

// =============================================================================
// I/O Contract — Contratto strutturato input/output per ogni step
// =============================================================================

/**
 * Definizione del contratto I/O come JSON Schema serializzabile.
 * Usiamo una rappresentazione JSON-safe anziché z.ZodType diretto
 * per permettere serializzazione/deserializzazione del piano.
 */
export const IOFieldSchema = z.object({
  name: z.string().describe("Nome del campo"),
  type: z
    .enum(["string", "number", "boolean", "array", "object", "any"])
    .describe("Tipo del campo"),
  description: z.string().optional(),
  required: z.boolean().default(true),
});
export type IOField = z.infer<typeof IOFieldSchema>;

export const StepContractSchema = z.object({
  /** Campi di input attesi — cosa serve allo step per eseguire */
  inputs: z.array(IOFieldSchema).default([]),
  /** Campi di output prodotti — cosa produce lo step */
  outputs: z.array(IOFieldSchema).default([]),
});
export type StepContract = z.infer<typeof StepContractSchema>;

// =============================================================================
// Step Result — Risultato dell'esecuzione di uno step
// =============================================================================

export const StepResultSchema = z.object({
  /** Output testuale prodotto */
  output: z.string().optional(),
  /** Dati strutturati di output (match con contract.outputs) */
  data: z.record(z.string(), z.unknown()).optional(),
  /** Uso token */
  tokenUsage: z
    .object({ input: z.number(), output: z.number() })
    .optional(),
  /** Durata in ms */
  durationMs: z.number().optional(),
  /** Errore se fallito */
  error: z.string().optional(),
});
export type StepResult = z.infer<typeof StepResultSchema>;

// =============================================================================
// Condition — Condizione per step condizionali
// =============================================================================

export const StepConditionSchema = z.object({
  /** Espressione condizionale (riferimenti a output di step precedenti) */
  expression: z.string().describe(
    "Espressione valutabile, es: 'steps.auth-design.status === completed'"
  ),
  /** ID dello step da eseguire se la condizione è vera */
  ifTrueStepId: z.string().optional(),
  /** ID dello step da eseguire se la condizione è falsa */
  ifFalseStepId: z.string().optional(),
});
export type StepCondition = z.infer<typeof StepConditionSchema>;

// =============================================================================
// Loop Config — Configurazione per step di tipo loop
// =============================================================================

export const LoopConfigSchema = z.object({
  /** Condizione di continuazione */
  condition: z.string().describe(
    "Espressione per continuare il loop, es: 'iteration < 3 && !steps.validate.data.allPassing'"
  ),
  /** Numero massimo di iterazioni (safety) */
  maxIterations: z.number().int().positive().default(10),
  /** ID dello step che funge da corpo del loop */
  bodyStepIds: z.array(z.string()).min(1),
});
export type LoopConfig = z.infer<typeof LoopConfigSchema>;

// =============================================================================
// SubStep — Livello ricorsivo di step annidati
// =============================================================================

// Definizione ricorsiva: SubStep può contenere altri SubStep
const BaseSubStepSchema = z.object({
  id: z.string().describe("ID univoco del sotto-step (kebab-case)"),
  title: z.string().describe("Titolo breve del sotto-step"),
  description: z.string().optional(),
  status: StepStatusSchema.default("idle"),
  executionMode: StepExecutionModeSchema.default("sequential"),
  contract: StepContractSchema.optional(),
  resources: ResourceRequirementsSchema.optional(),
  result: StepResultSchema.optional(),
  /** Istruzioni/prompt per l'agente che esegue questo sotto-step */
  prompt: z.string().optional(),
  /** Tool specifici richiesti per questo sotto-step */
  requiredTools: z.array(z.string()).default([]),
});

export type SubStep = z.infer<typeof BaseSubStepSchema> & {
  children?: SubStep[];
};

// Use 'as any' cast to satisfy recursive ZodType — standard pattern for Zod lazy recursion
export const SubStepSchema: z.ZodType<SubStep> = BaseSubStepSchema.extend({
  children: z.lazy(() => z.array(SubStepSchema)).optional(),
}) as any;

// =============================================================================
// Step — Unità atomica di lavoro con contratto I/O
// =============================================================================

export const StepSchema = z.object({
  id: z.string().describe("ID univoco dello step (kebab-case)"),
  title: z.string().describe("Titolo breve dello step"),
  description: z.string().optional().describe("Descrizione dettagliata"),

  /** Modalità di esecuzione */
  executionMode: StepExecutionModeSchema.default("sequential"),

  /** Stato corrente */
  status: StepStatusSchema.default("idle"),

  /** Priorità */
  priority: StepPrioritySchema.default("medium"),

  /** Contratto input/output strutturato */
  contract: StepContractSchema.default({ inputs: [], outputs: [] }),

  /** Requisiti di risorse */
  resources: ResourceRequirementsSchema.optional(),

  /** Dipendenze esplicite: ID di step nella stessa fase o in fasi precedenti */
  dependencies: z.array(z.string()).default([]),

  /** Istruzioni/prompt per l'agente */
  prompt: z.string().optional().describe(
    "Prompt specifico per l'agente che esegue questo step"
  ),

  /** Tool specifici richiesti */
  requiredTools: z.array(z.string()).default([]),

  /** Sotto-step (gerarchia ricorsiva) */
  subSteps: z.array(SubStepSchema).default([]),

  /** Condizione (solo se executionMode === 'conditional') */
  condition: StepConditionSchema.optional(),

  /** Configurazione loop (solo se executionMode === 'loop') */
  loopConfig: LoopConfigSchema.optional(),

  /** Risultato dell'esecuzione */
  result: StepResultSchema.optional(),

  /** Timestamp */
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),

  /** Metadati arbitrari */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Step = z.infer<typeof StepSchema>;

// =============================================================================
// Phase — Raggruppamento logico di step
// =============================================================================

export const PhaseSchema = z.object({
  id: z.string().describe("ID univoco della fase (kebab-case)"),
  title: z.string().describe("Titolo della fase"),
  description: z.string().optional(),

  /** Come eseguire gli step dentro questa fase */
  executionMode: StepExecutionModeSchema.default("sequential"),

  /** Stato derivato dagli step contenuti */
  status: StepStatusSchema.default("idle"),

  /** Step contenuti in questa fase */
  steps: z.array(StepSchema).min(1).describe("Step della fase"),

  /** Ordine (per fasi sequenziali nel piano) */
  order: z.number().int().min(0).default(0),

  /** Dipendenze da altre fasi (ID) */
  dependencies: z.array(z.string()).default([]),

  /** Requisiti di risorse per l'intera fase */
  resources: ResourceRequirementsSchema.optional(),

  /** Timestamp */
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
});
export type Phase = z.infer<typeof PhaseSchema>;

// =============================================================================
// Plan — Root del piano gerarchico
// =============================================================================

export const PlanMetadataSchema = z.object({
  /** Chi ha creato il piano (agente o umano) */
  createdBy: z.string().default("agent"),
  /** Versione del piano (incrementa ad ogni modifica) */
  version: z.number().int().min(1).default(1),
  /** Tag liberi per classificazione */
  tags: z.array(z.string()).default([]),
  /** Obiettivo di alto livello che il piano deve raggiungere */
  goal: z.string().describe("Obiettivo principale del piano"),
  /** Contesto/vincoli aggiuntivi */
  constraints: z.array(z.string()).default([]),
  /** Stima dei token totali per l'intero piano */
  estimatedTotalTokens: z.number().optional(),
  /** Stima della durata totale in ms */
  estimatedDurationMs: z.number().optional(),
});
export type PlanMetadata = z.infer<typeof PlanMetadataSchema>;

export const PlanSchema = z.object({
  id: z.string().describe("ID univoco del piano (kebab-case)"),
  title: z.string().describe("Titolo del piano"),
  description: z.string().optional().describe("Descrizione del piano"),

  /** Stato globale del piano */
  status: PlanStatusSchema.default("draft"),

  /** Metadata del piano */
  metadata: PlanMetadataSchema,

  /** Fasi del piano (ordinate) */
  phases: z.array(PhaseSchema).min(1).describe("Fasi del piano"),

  /** Configurazione risorse globali */
  globalResources: ResourceRequirementsSchema.optional(),

  /** Timestamp */
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

// =============================================================================
// Plan Events — Eventi osservabili durante l'esecuzione del piano
// =============================================================================

export const PlanEventTypeSchema = z.enum([
  "plan:created",
  "plan:started",
  "plan:paused",
  "plan:resumed",
  "plan:completed",
  "plan:failed",
  "plan:cancelled",
  "plan:updated",
  "phase:started",
  "phase:completed",
  "phase:failed",
  "step:started",
  "step:completed",
  "step:failed",
  "step:skipped",
  "step:blocked",
  "step:retrying",
  "substep:started",
  "substep:completed",
  "substep:failed",
]);
export type PlanEventType = z.infer<typeof PlanEventTypeSchema>;

export const PlanEventSchema = z.object({
  type: PlanEventTypeSchema,
  planId: z.string(),
  phaseId: z.string().optional(),
  stepId: z.string().optional(),
  subStepId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type PlanEvent = z.infer<typeof PlanEventSchema>;

// =============================================================================
// Progress — Snapshot del progresso del piano
// =============================================================================

export const StepProgressSchema = z.object({
  stepId: z.string(),
  title: z.string(),
  status: StepStatusSchema,
  /** Progresso dei sotto-step (0.0 - 1.0) */
  progress: z.number().min(0).max(1).default(0),
  /** Numero sotto-step completati / totali */
  subStepsDone: z.number().int().min(0).default(0),
  subStepsTotal: z.number().int().min(0).default(0),
});
export type StepProgress = z.infer<typeof StepProgressSchema>;

export const PhaseProgressSchema = z.object({
  phaseId: z.string(),
  title: z.string(),
  status: StepStatusSchema,
  progress: z.number().min(0).max(1).default(0),
  steps: z.array(StepProgressSchema),
});
export type PhaseProgress = z.infer<typeof PhaseProgressSchema>;

export const PlanProgressSchema = z.object({
  planId: z.string(),
  title: z.string(),
  status: PlanStatusSchema,
  /** Progresso globale (0.0 - 1.0) */
  progress: z.number().min(0).max(1).default(0),
  /** Conteggi globali */
  totalSteps: z.number().int().min(0),
  completedSteps: z.number().int().min(0),
  failedSteps: z.number().int().min(0),
  /** Dettaglio per fase */
  phases: z.array(PhaseProgressSchema),
  /** Durata totale fino ad ora */
  elapsedMs: z.number().optional(),
  /** Token usati fino ad ora */
  tokenUsage: z
    .object({ input: z.number(), output: z.number() })
    .optional(),
});
export type PlanProgress = z.infer<typeof PlanProgressSchema>;

// =============================================================================
// Factory Functions — Creazione rapida di entità del piano
// =============================================================================

let _stepCounter = 0;

/** Crea uno Step con defaults ragionevoli */
export function createStep(
  overrides: Partial<Step> & Pick<Step, "id" | "title">
): Step {
  return StepSchema.parse({
    executionMode: "sequential",
    status: "idle",
    priority: "medium",
    contract: { inputs: [], outputs: [] },
    dependencies: [],
    requiredTools: [],
    subSteps: [],
    ...overrides,
  });
}

/** Crea una Phase con defaults ragionevoli */
export function createPhase(
  overrides: Partial<Phase> & Pick<Phase, "id" | "title" | "steps">
): Phase {
  return PhaseSchema.parse({
    executionMode: "sequential",
    status: "idle",
    dependencies: [],
    ...overrides,
  });
}

/** Crea un SubStep con defaults ragionevoli */
export function createSubStep(
  overrides: Partial<SubStep> & Pick<SubStep, "id" | "title">
): SubStep {
  return SubStepSchema.parse({
    status: "idle",
    executionMode: "sequential",
    requiredTools: [],
    ...overrides,
  });
}

/** Crea un Plan completo con defaults ragionevoli */
export function createPlan(
  overrides: Partial<Plan> & Pick<Plan, "id" | "title" | "metadata" | "phases">
): Plan {
  return PlanSchema.parse({
    status: "draft",
    ...overrides,
  });
}

/** Genera un ID univoco per step basato su prefisso */
export function generateStepId(prefix: string): string {
  return `${prefix}-${++_stepCounter}`;
}

// =============================================================================
// Validazione — Controlli strutturali sul piano
// =============================================================================

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Valida la struttura e la coerenza di un piano */
export function validatePlan(plan: Plan): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allStepIds = new Set<string>();
  const allPhaseIds = new Set<string>();

  // Raccogli tutti gli ID
  for (const phase of plan.phases) {
    if (allPhaseIds.has(phase.id)) {
      errors.push(`ID fase duplicato: "${phase.id}"`);
    }
    allPhaseIds.add(phase.id);

    for (const step of phase.steps) {
      if (allStepIds.has(step.id)) {
        errors.push(`ID step duplicato: "${step.id}"`);
      }
      allStepIds.add(step.id);
      collectSubStepIds(step.subSteps, allStepIds, errors);
    }
  }

  // Valida dipendenze
  for (const phase of plan.phases) {
    for (const dep of phase.dependencies) {
      if (!allPhaseIds.has(dep)) {
        errors.push(`Fase "${phase.id}" dipende da fase inesistente "${dep}"`);
      }
      if (dep === phase.id) {
        errors.push(`Fase "${phase.id}" dipende da se stessa`);
      }
    }

    for (const step of phase.steps) {
      for (const dep of step.dependencies) {
        if (!allStepIds.has(dep)) {
          errors.push(
            `Step "${step.id}" dipende da step inesistente "${dep}"`
          );
        }
        if (dep === step.id) {
          errors.push(`Step "${step.id}" dipende da se stesso`);
        }
      }

      // Valida coerenza mode/config
      if (step.executionMode === "conditional" && !step.condition) {
        errors.push(
          `Step "${step.id}" è condizionale ma manca la configurazione condition`
        );
      }
      if (step.executionMode === "loop" && !step.loopConfig) {
        errors.push(
          `Step "${step.id}" è loop ma manca la configurazione loopConfig`
        );
      }

      // Warnings per contratti mancanti
      if (step.contract.inputs.length === 0 && step.dependencies.length > 0) {
        warnings.push(
          `Step "${step.id}" ha dipendenze ma nessun input definito nel contratto`
        );
      }
    }
  }

  // Valida cicli tra fasi
  const phaseDepErrors = detectCycles(
    plan.phases.map((p) => p.id),
    plan.phases.reduce(
      (acc, p) => { acc[p.id] = p.dependencies; return acc; },
      {} as Record<string, string[]>,
    ),
  );
  errors.push(...phaseDepErrors);

  return { valid: errors.length === 0, errors, warnings };
}

function collectSubStepIds(
  subSteps: SubStep[],
  allIds: Set<string>,
  errors: string[],
): void {
  for (const ss of subSteps) {
    if (allIds.has(ss.id)) {
      errors.push(`ID sotto-step duplicato: "${ss.id}"`);
    }
    allIds.add(ss.id);
    if (ss.children) {
      collectSubStepIds(ss.children, allIds, errors);
    }
  }
}

function detectCycles(
  nodeIds: string[],
  deps: Record<string, string[]>,
): string[] {
  const errors: string[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (id: string): void => {
    if (stack.has(id)) {
      errors.push(`Ciclo rilevato che coinvolge "${id}"`);
      return;
    }
    if (visited.has(id)) return;
    stack.add(id);
    for (const dep of deps[id] ?? []) {
      visit(dep);
    }
    stack.delete(id);
    visited.add(id);
  };

  for (const id of nodeIds) {
    visit(id);
  }
  return errors;
}

// =============================================================================
// State Machine Helpers — Transizioni di stato sicure
// =============================================================================

/** Verifica se una transizione di stato dello step è valida */
export function isValidStepTransition(
  from: StepStatus,
  to: StepStatus,
): boolean {
  return STEP_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Verifica se una transizione di stato del piano è valida */
export function isValidPlanTransition(
  from: PlanStatus,
  to: PlanStatus,
): boolean {
  return PLAN_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Esegue una transizione di stato su uno step con validazione */
export function transitionStep(step: Step, newStatus: StepStatus): Step {
  if (!isValidStepTransition(step.status, newStatus)) {
    throw new Error(
      `Transizione step non valida: "${step.status}" → "${newStatus}" per step "${step.id}"`
    );
  }
  const now = Date.now();
  return {
    ...step,
    status: newStatus,
    updatedAt: now,
    ...(newStatus === "running" ? { startedAt: now } : {}),
    ...(newStatus === "completed" || newStatus === "failed"
      ? { completedAt: now }
      : {}),
  };
}

// =============================================================================
// Progress Calculator — Calcola il progresso del piano
// =============================================================================

/** Calcola il progresso complessivo del piano */
export function calculateProgress(plan: Plan): PlanProgress {
  let totalSteps = 0;
  let completedSteps = 0;
  let failedSteps = 0;

  const phaseProgresses: PhaseProgress[] = plan.phases.map((phase) => {
    const stepProgresses: StepProgress[] = phase.steps.map((step) => {
      totalSteps++;
      const subTotal = countSubSteps(step.subSteps);
      const subDone = countCompletedSubSteps(step.subSteps);

      if (step.status === "completed") completedSteps++;
      if (step.status === "failed") failedSteps++;

      const stepProgress =
        step.status === "completed"
          ? 1
          : step.status === "running" && subTotal > 0
            ? subDone / subTotal
            : 0;

      return {
        stepId: step.id,
        title: step.title,
        status: step.status,
        progress: stepProgress,
        subStepsDone: subDone,
        subStepsTotal: subTotal,
      };
    });

    const phaseTotal = stepProgresses.length;
    const phaseProgress =
      phaseTotal > 0
        ? stepProgresses.reduce((sum, s) => sum + s.progress, 0) / phaseTotal
        : 0;

    const phaseStatus = derivePhaseStatus(phase.steps);

    return {
      phaseId: phase.id,
      title: phase.title,
      status: phaseStatus,
      progress: phaseProgress,
      steps: stepProgresses,
    };
  });

  const globalProgress =
    totalSteps > 0 ? completedSteps / totalSteps : 0;

  const elapsedMs = plan.startedAt
    ? Date.now() - plan.startedAt
    : undefined;

  return {
    planId: plan.id,
    title: plan.title,
    status: plan.status,
    progress: globalProgress,
    totalSteps,
    completedSteps,
    failedSteps,
    phases: phaseProgresses,
    elapsedMs,
  };
}

function countSubSteps(subSteps: SubStep[]): number {
  let count = 0;
  for (const ss of subSteps) {
    count++;
    if (ss.children) count += countSubSteps(ss.children);
  }
  return count;
}

function countCompletedSubSteps(subSteps: SubStep[]): number {
  let count = 0;
  for (const ss of subSteps) {
    if (ss.status === "completed") count++;
    if (ss.children) count += countCompletedSubSteps(ss.children);
  }
  return count;
}

function derivePhaseStatus(steps: Step[]): StepStatus {
  if (steps.every((s) => s.status === "completed")) return "completed";
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.some((s) => s.status === "running")) return "running";
  if (steps.some((s) => s.status === "pending")) return "pending";
  if (steps.some((s) => s.status === "blocked")) return "blocked";
  return "idle";
}

// =============================================================================
// Retrocompatibilità — Conversione Todo[] → Plan
// =============================================================================

import type { Todo } from "./todo.schema.js";

/** Converte una lista di Todo legacy in un Plan strutturato */
export function todosToplan(todos: Todo[], planTitle: string = "Piano Migrato"): Plan {
  const steps: Step[] = todos.map((todo) =>
    createStep({
      id: todo.id,
      title: todo.title,
      description: todo.description,
      status: mapTodoStatus(todo.status),
      priority: todo.priority as StepPriority,
      dependencies: todo.dependencies,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      completedAt: todo.completedAt,
    }),
  );

  return createPlan({
    id: `migrated-${Date.now()}`,
    title: planTitle,
    metadata: {
      goal: planTitle,
      createdBy: "migration",
      version: 1,
      tags: ["migrated-from-todos"],
      constraints: [],
    },
    phases: [
      createPhase({
        id: "migrated-phase",
        title: "Task Migrati",
        steps,
      }),
    ],
  });
}

function mapTodoStatus(
  status: "pending" | "in_progress" | "done" | "blocked",
): StepStatus {
  const mapping: Record<string, StepStatus> = {
    pending: "pending",
    in_progress: "running",
    done: "completed",
    blocked: "blocked",
  };
  return mapping[status] ?? "idle";
}

// =============================================================================
// Esempio — Piano completo per "Costruisci API REST con auth"
// =============================================================================

/**
 * Genera un piano di esempio per dimostrare la struttura completa.
 * Utilizzabile per test e documentazione.
 */
export function createExamplePlan(): Plan {
  return createPlan({
    id: "api-rest-auth",
    title: "Costruisci API REST con Autenticazione",
    description:
      "Piano completo per creare un'API REST con autenticazione JWT, " +
      "database PostgreSQL, testing e deployment.",
    metadata: {
      goal: "Creare un'API REST production-ready con auth JWT",
      createdBy: "architect-agent",
      version: 1,
      tags: ["api", "rest", "auth", "jwt", "postgresql"],
      constraints: [
        "TypeScript strict mode",
        "100% test coverage sulle route critiche",
        "Response time < 200ms per endpoint",
      ],
      estimatedTotalTokens: 500_000,
      estimatedDurationMs: 1_800_000,
    },
    phases: [
      // --- Fase 1: Design ---
      createPhase({
        id: "design",
        title: "Design & Architettura",
        order: 0,
        executionMode: "sequential",
        steps: [
          createStep({
            id: "db-schema-design",
            title: "Design schema database",
            description: "Progetta le tabelle users, sessions, roles",
            prompt:
              "Progetta lo schema PostgreSQL per un sistema di autenticazione " +
              "con users, sessions e roles. Includi indici e constraint.",
            priority: "high",
            contract: {
              inputs: [],
              outputs: [
                {
                  name: "sqlSchema",
                  type: "string",
                  description: "SQL DDL per le tabelle",
                  required: true,
                },
                {
                  name: "erDiagram",
                  type: "string",
                  description: "Diagramma ER in formato Mermaid",
                  required: false,
                },
              ],
            },
            resources: { maxTokenBudget: 50_000, timeoutMs: 120_000, maxRetries: 0, maxConcurrency: 5 },
          }),
          createStep({
            id: "api-design",
            title: "Design endpoint API",
            description: "Definisci OpenAPI spec per tutti gli endpoint",
            dependencies: ["db-schema-design"],
            prompt:
              "Basandoti sullo schema DB, definisci gli endpoint REST " +
              "per auth (register, login, logout, refresh) e user management.",
            contract: {
              inputs: [
                {
                  name: "sqlSchema",
                  type: "string",
                  description: "Schema DB dalla fase precedente",
                  required: true,
                },
              ],
              outputs: [
                {
                  name: "openApiSpec",
                  type: "string",
                  description: "Specifica OpenAPI 3.0 YAML",
                  required: true,
                },
              ],
            },
            resources: { maxTokenBudget: 80_000, timeoutMs: 180_000, maxRetries: 0, maxConcurrency: 5 },
          }),
        ],
      }),

      // --- Fase 2: Implementazione (parallela) ---
      createPhase({
        id: "implementation",
        title: "Implementazione",
        order: 1,
        executionMode: "parallel",
        dependencies: ["design"],
        resources: { maxConcurrency: 3, maxRetries: 0 },
        steps: [
          createStep({
            id: "impl-db-layer",
            title: "Implementa database layer",
            prompt: "Implementa il database layer con Drizzle ORM basandoti sullo schema.",
            dependencies: ["db-schema-design"],
            requiredTools: ["write_file", "read_file"],
            contract: {
              inputs: [
                { name: "sqlSchema", type: "string", required: true },
              ],
              outputs: [
                { name: "dbModuleFiles", type: "array", description: "File creati", required: true },
              ],
            },
            subSteps: [
              createSubStep({
                id: "impl-db-connection",
                title: "Setup connessione DB",
                prompt: "Configura la connessione PostgreSQL con pool.",
              }),
              createSubStep({
                id: "impl-db-models",
                title: "Definisci i modelli Drizzle",
                prompt: "Crea i modelli Drizzle per users, sessions, roles.",
              }),
              createSubStep({
                id: "impl-db-migrations",
                title: "Crea migration iniziale",
                prompt: "Genera la migration Drizzle per lo schema iniziale.",
              }),
            ],
          }),
          createStep({
            id: "impl-auth-service",
            title: "Implementa servizio auth",
            prompt:
              "Implementa il servizio di autenticazione con JWT, bcrypt per password, " +
              "refresh token rotation.",
            dependencies: ["api-design"],
            requiredTools: ["write_file", "read_file"],
            contract: {
              inputs: [
                { name: "openApiSpec", type: "string", required: true },
              ],
              outputs: [
                { name: "authServiceFiles", type: "array", required: true },
              ],
            },
          }),
          createStep({
            id: "impl-middleware",
            title: "Implementa middleware auth",
            prompt: "Implementa il middleware di autenticazione JWT per proteggere le route.",
            dependencies: ["api-design"],
            requiredTools: ["write_file"],
            contract: {
              inputs: [
                { name: "openApiSpec", type: "string", required: true },
              ],
              outputs: [
                {
                  name: "middlewareFile",
                  type: "string",
                  description: "Path del file middleware",
                  required: true,
                },
              ],
            },
          }),
        ],
      }),

      // --- Fase 3: Testing ---
      createPhase({
        id: "testing",
        title: "Testing",
        order: 2,
        executionMode: "parallel",
        dependencies: ["implementation"],
        steps: [
          createStep({
            id: "test-unit",
            title: "Unit test",
            prompt: "Scrivi unit test per auth service e middleware con Vitest.",
            dependencies: ["impl-auth-service", "impl-middleware"],
            requiredTools: ["write_file", "run_command"],
            contract: {
              inputs: [
                { name: "authServiceFiles", type: "array", required: true },
                { name: "middlewareFile", type: "string", required: true },
              ],
              outputs: [
                { name: "testResults", type: "object", description: "Risultati test", required: true },
              ],
            },
          }),
          createStep({
            id: "test-integration",
            title: "Integration test",
            prompt:
              "Scrivi integration test per i flussi completi: register → login → " +
              "access protected → refresh → logout.",
            dependencies: ["impl-db-layer", "impl-auth-service"],
            requiredTools: ["write_file", "run_command"],
            contract: {
              inputs: [
                { name: "dbModuleFiles", type: "array", required: true },
                { name: "authServiceFiles", type: "array", required: true },
              ],
              outputs: [
                { name: "integrationResults", type: "object", required: true },
              ],
            },
          }),
        ],
      }),

      // --- Fase 4: Validazione (condizionale + loop) ---
      createPhase({
        id: "validation",
        title: "Validazione & Fix",
        order: 3,
        executionMode: "sequential",
        dependencies: ["testing"],
        steps: [
          createStep({
            id: "validate-coverage",
            title: "Verifica coverage",
            executionMode: "conditional",
            prompt: "Verifica che la coverage sia >= 90%.",
            dependencies: ["test-unit", "test-integration"],
            condition: {
              expression:
                'steps["test-unit"].result.data.testResults.coverage >= 90',
              ifTrueStepId: "deploy-prep",
              ifFalseStepId: "fix-coverage",
            },
            contract: {
              inputs: [
                { name: "testResults", type: "object", required: true },
                { name: "integrationResults", type: "object", required: true },
              ],
              outputs: [
                { name: "coverageOk", type: "boolean", required: true },
              ],
            },
          }),
          createStep({
            id: "fix-coverage",
            title: "Fix coverage insufficiente",
            executionMode: "loop",
            prompt: "Aggiungi test per migliorare la coverage al 90%.",
            loopConfig: {
              condition: "!steps['validate-coverage'].result?.data?.coverageOk",
              maxIterations: 3,
              bodyStepIds: ["test-unit"],
            },
            contract: {
              inputs: [
                { name: "coverageOk", type: "boolean", required: true },
              ],
              outputs: [
                { name: "additionalTests", type: "array", required: true },
              ],
            },
          }),
        ],
      }),
    ],
  });
}
