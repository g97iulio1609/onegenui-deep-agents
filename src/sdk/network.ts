/**
 * Network SDK wrapper — multi-agent delegation backed by Rust core.
 */
import {
  create_network,
  network_add_agent,
  network_set_supervisor,
  network_delegate,
  network_agent_cards,
  destroy_network,
} from "gauss-napi";

import type { Handle, Disposable, ProviderType } from "./types.js";
import { Agent } from "./agent.js";
import { DisposedError } from "./errors.js";

export interface NetworkQuickAgentSpec {
  name: string;
  provider?: ProviderType;
  model?: string;
  instructions?: string;
}

export interface NetworkAddAgentOptions {
  instructions?: string;
}

export type NetworkTemplateName =
  | "research-delivery"
  | "incident-response"
  | "support-triage"
  | "fintech-risk-review"
  | "rag-ops";

export interface NetworkTemplateSpec {
  supervisor: string;
  agents: NetworkQuickAgentSpec[];
}

export class Network implements Disposable {
  private readonly _handle: Handle;
  private disposed = false;
  private supervisorName: string | null = null;

  /**
   * Quick network builder for swarm/team-like setups in a few lines.
   */
  static quick(supervisor: string, agents: NetworkQuickAgentSpec[]): Network {
    const network = new Network();
    for (const spec of agents) {
      const agent = new Agent({
        name: spec.name,
        provider: spec.provider ?? "openai",
        model: spec.model ?? "gpt-4o",
        instructions: spec.instructions,
      });
      network.addAgent(agent, spec.instructions);
    }
    network.setSupervisor(supervisor);
    return network;
  }

  /**
   * Built-in swarm templates for rapid bootstrap.
   */
  static template(name: NetworkTemplateName): NetworkTemplateSpec {
    if (name === "research-delivery") {
      return {
        supervisor: "lead",
        agents: [
          { name: "lead", instructions: "Coordinate and delegate work." },
          { name: "researcher", instructions: "Research context and constraints." },
          { name: "implementer", instructions: "Implement practical solutions." },
        ],
      };
    }
    if (name === "incident-response") {
      return {
        supervisor: "incident-commander",
        agents: [
          { name: "incident-commander", instructions: "Drive response and coordination." },
          { name: "triage", instructions: "Assess impact and prioritize mitigation." },
          { name: "remediator", instructions: "Propose and execute remediation steps." },
        ],
      };
    }
    if (name === "support-triage") {
      return {
        supervisor: "support-lead",
        agents: [
          { name: "support-lead", instructions: "Coordinate support workload and escalations." },
          { name: "triage-bot", instructions: "Classify incoming support requests." },
          { name: "resolver", instructions: "Draft and validate customer resolutions." },
        ],
      };
    }
    if (name === "fintech-risk-review") {
      return {
        supervisor: "risk-lead",
        agents: [
          { name: "risk-lead", instructions: "Approve risk recommendations and report rationale." },
          { name: "policy-analyst", instructions: "Map events to compliance policy obligations." },
          { name: "fraud-scorer", instructions: "Score suspicious patterns and flag anomalies." },
        ],
      };
    }
    return {
      supervisor: "rag-ops-lead",
      agents: [
        { name: "rag-ops-lead", instructions: "Coordinate retrieval quality and index freshness." },
        { name: "retrieval-auditor", instructions: "Audit recall/precision and retrieval grounding." },
        { name: "index-maintainer", instructions: "Propose chunking and indexing improvements." },
      ],
    };
  }

  static fromTemplate(name: NetworkTemplateName): Network {
    const template = Network.template(name);
    return Network.quick(template.supervisor, template.agents);
  }

  constructor() {
    this._handle = create_network();
  }

  get handle(): Handle {
    return this._handle;
  }

  addAgent(agent: Agent, options?: NetworkAddAgentOptions | string): this {
    this.assertNotDisposed();
    const instructions = typeof options === "string" ? options : options?.instructions;
    network_add_agent(
      this._handle,
      agent.name,
      agent.handle,
      instructions
    );
    return this;
  }

  setSupervisor(agentName: string): this {
    this.assertNotDisposed();
    this.supervisorName = agentName;
    network_set_supervisor(this._handle, agentName);
    return this;
  }

  async delegate(agentName: string, prompt: string): Promise<unknown>;
  async delegate(fromAgent: string, toAgent: string, prompt: string): Promise<unknown>;
  async delegate(arg1: string, arg2: string, arg3?: string): Promise<unknown> {
    this.assertNotDisposed();
    const agentName = arg3 === undefined ? arg1 : arg2;
    const prompt = arg3 === undefined ? arg2 : arg3;
    return network_delegate(this._handle, agentName, prompt);
  }

  async delegateWithSupervisor(prompt: string): Promise<unknown> {
    this.assertNotDisposed();
    if (!this.supervisorName) {
      throw new Error("Network supervisor is not set. Call setSupervisor() first.");
    }
    return network_delegate(this._handle, this.supervisorName, prompt);
  }

  agentCards(): unknown {
    this.assertNotDisposed();
    return network_agent_cards(this._handle);
  }

  destroy(): void {
    if (!this.disposed) {
      this.disposed = true;
      destroy_network(this._handle);
    }
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new DisposedError("Network", "network");
    }
  }
}
