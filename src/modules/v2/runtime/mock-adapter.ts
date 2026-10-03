import type {
  AgentExecutionRequest,
  ApprovalDecision,
  ApprovalRequest,
  CapabilityNegotiationRequest,
  CapabilityNegotiationResult,
  NoVARuntimeAdapter,
  RuntimeExecutionReference,
  RuntimeExecutionResult,
  ToolInvocationRequest,
  WorkflowExecutionRequest,
} from './contracts'
import type { UUID } from '../domain/model'

/**
 * Contract-only test double.
 *
 * It acknowledges requests without pretending to execute agents, workflows or tools.
 * Replace this adapter with the real NoVA adapter; do not move execution mechanics here.
 */
export class MockNoVARuntimeAdapter implements NoVARuntimeAdapter {
  readonly requests: Array<AgentExecutionRequest | WorkflowExecutionRequest | ToolInvocationRequest> = []
  private readonly runs = new Map<UUID, RuntimeExecutionReference>()

  async startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.accept(request, request.agentId)
  }

  async startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.accept(request, request.workflowId)
  }

  async invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference> {
    return this.accept(request, request.toolId)
  }

  async getRun(runId: UUID): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined> {
    return this.runs.get(runId)
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalRequest> {
    return request
  }

  async resolveApproval(decision: ApprovalDecision): Promise<ApprovalDecision> {
    return decision
  }

  async negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult> {
    const supported = request.requestedCapabilities.filter((capability) => capability === 'agent.execute' || capability === 'workflow.execute' || capability === 'tool.invoke')
    const rejected = request.requestedCapabilities.filter((capability) => !supported.includes(capability))
    return { supported, rejected }
  }

  private accept(
    request: AgentExecutionRequest | WorkflowExecutionRequest | ToolInvocationRequest,
    _subjectId: UUID,
  ): RuntimeExecutionReference {
    this.requests.push(request)
    const reference: RuntimeExecutionReference = {
      runId: request.correlationId,
      state: 'accepted',
      acceptedAt: new Date().toISOString(),
    }
    this.runs.set(reference.runId, reference)
    return reference
  }
}