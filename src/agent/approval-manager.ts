// =============================================================================
// Approval Manager — Tool call approval logic
// =============================================================================

import type {
  ApprovalConfig,
  ApprovalRequest,
  AgentEvent,
  AgentEventHandler,
} from "../types.js";

/**
 * Manages tool-call approval decisions based on allow/deny lists
 * and an async approval callback for tools requiring human review.
 */
export class ApprovalManager {
  private readonly config: Required<ApprovalConfig>;
  private readonly sessionId: string;
  private readonly eventHandler?: AgentEventHandler;

  constructor(
    config: Required<ApprovalConfig>,
    sessionId: string,
    eventHandler?: AgentEventHandler,
  ) {
    this.config = config;
    this.sessionId = sessionId;
    this.eventHandler = eventHandler;
  }

  /**
   * Synchronous check whether a tool is auto-approved by configuration.
   *
   * - "approve-all": returns true unless tool is in `requireApproval`
   * - "deny-all": returns true only if tool is in `autoApprove`
   */
  shouldApprove(toolName: string): boolean {
    if (this.config.defaultMode === "approve-all") {
      return !this.config.requireApproval.includes(toolName);
    }
    return this.config.autoApprove.includes(toolName);
  }

  /**
   * Requests approval via the configured callback, emitting lifecycle events.
   */
  async requestApproval(
    request: ApprovalRequest,
  ): Promise<{ approved: boolean; reason?: string }> {
    this.emit("tool:approval-required", request);

    const approved = await this.config.onApprovalRequired(request);

    if (approved) {
      this.emit("tool:approved", { toolName: request.toolName, toolCallId: request.toolCallId });
    } else {
      this.emit("tool:denied", { toolName: request.toolName, toolCallId: request.toolCallId });
    }

    return {
      approved,
      reason: approved ? undefined : "Approval denied by callback",
    };
  }

  /**
   * Combined check: auto-approves when policy allows, otherwise delegates
   * to the async approval flow.
   */
  async checkAndApprove(
    toolName: string,
    toolCallId: string,
    args: unknown,
    stepIndex: number,
  ): Promise<{ approved: boolean; reason?: string }> {
    if (this.shouldApprove(toolName)) {
      return { approved: true };
    }

    return this.requestApproval({
      toolName,
      toolCallId,
      args,
      sessionId: this.sessionId,
      stepIndex,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private emit(type: AgentEvent["type"], data: unknown): void {
    this.eventHandler?.({
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data,
    });
  }
}
