// SupabaseMemoryAdapter — Supabase-backed implementation of MemoryPort

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemoryPort } from "../../ports/memory.port.js";
import type { Todo } from "../../domain/todo.schema.js";
import { CheckpointSchema, type Checkpoint } from "../../domain/checkpoint.schema.js";
import type { Message } from "../../types.js";

const T_TODOS = "deep_agent_todos";
const T_CKPT = "deep_agent_checkpoints";
const T_CONV = "deep_agent_conversations";
const T_META = "deep_agent_metadata";

export interface SupabaseMemoryAdapterOptions {
  strict?: boolean;
}

function warn(method: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[SupabaseMemoryAdapter.${method}] ${msg}`);
}

export class SupabaseMemoryAdapter implements MemoryPort {
  private readonly strict: boolean;

  constructor(
    private readonly supabase: SupabaseClient,
    options?: SupabaseMemoryAdapterOptions,
  ) {
    this.strict = options?.strict ?? false;
  }

  private handleError(method: string, err: unknown): void {
    warn(method, err);
    if (this.strict) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async saveTodos(sessionId: string, todos: Todo[]): Promise<void> {
    const { error } = await this.supabase.from(T_TODOS).upsert(
      { session_id: sessionId, todos, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
    if (error) this.handleError("saveTodos", error);
  }

  async loadTodos(sessionId: string): Promise<Todo[]> {
    const { data, error } = await this.supabase
      .from(T_TODOS).select("todos").eq("session_id", sessionId).single();
    if (error) { this.handleError("loadTodos", error); return []; }
    return (data?.todos as Todo[]) ?? [];
  }

  async saveCheckpoint(sessionId: string, checkpoint: Checkpoint): Promise<void> {
    const { error } = await this.supabase.from(T_CKPT).insert({
      id: checkpoint.id,
      session_id: sessionId,
      step_index: checkpoint.stepIndex,
      state: checkpoint,
      created_at: new Date(checkpoint.createdAt).toISOString(),
    });
    if (error) this.handleError("saveCheckpoint", error);
  }

  async loadLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
    const { data, error } = await this.supabase
      .from(T_CKPT).select("state").eq("session_id", sessionId)
      .order("step_index", { ascending: false }).limit(1).maybeSingle();
    if (error) { this.handleError("loadLatestCheckpoint", error); return null; }
    if (!data?.state) return null;
    const parsed = CheckpointSchema.safeParse(data.state);
    if (!parsed.success) {
      this.handleError("loadLatestCheckpoint", parsed.error);
      return null;
    }
    return parsed.data;
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    const { data, error } = await this.supabase
      .from(T_CKPT).select("state").eq("session_id", sessionId)
      .order("step_index", { ascending: true });
    if (error) { this.handleError("listCheckpoints", error); return []; }
    return (data ?? []).map((r) => r.state as Checkpoint);
  }

  async deleteOldCheckpoints(sessionId: string, keepCount: number): Promise<void> {
    const { data, error } = await this.supabase
      .from(T_CKPT).select("id").eq("session_id", sessionId)
      .order("step_index", { ascending: false });
    if (error || !data) { this.handleError("deleteOldCheckpoints", error); return; }
    const idsToDelete = data.slice(keepCount).map((r) => r.id as string);
    if (idsToDelete.length === 0) return;
    const { error: delErr } = await this.supabase
      .from(T_CKPT).delete().in("id", idsToDelete);
    if (delErr) this.handleError("deleteOldCheckpoints.delete", delErr);
  }

  async saveConversation(sessionId: string, messages: Message[]): Promise<void> {
    const { error } = await this.supabase.from(T_CONV).upsert(
      { session_id: sessionId, messages, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
    if (error) this.handleError("saveConversation", error);
  }

  async loadConversation(sessionId: string): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from(T_CONV).select("messages").eq("session_id", sessionId).single();
    if (error) { this.handleError("loadConversation", error); return []; }
    return (data?.messages as Message[]) ?? [];
  }

  async saveMetadata(sessionId: string, key: string, value: unknown): Promise<void> {
    const { error } = await this.supabase.from(T_META).upsert(
      { session_id: sessionId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "session_id,key" },
    );
    if (error) this.handleError("saveMetadata", error);
  }

  async loadMetadata<T = unknown>(sessionId: string, key: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(T_META).select("value")
      .eq("session_id", sessionId).eq("key", key).maybeSingle();
    if (error) { this.handleError("loadMetadata", error); return null; }
    return (data?.value as T) ?? null;
  }

  async deleteMetadata(sessionId: string, key: string): Promise<void> {
    const { error } = await this.supabase
      .from(T_META).delete().eq("session_id", sessionId).eq("key", key);
    if (error) this.handleError("deleteMetadata", error);
  }
}
