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
/**
 * Contract-only test double.
 *
 * It acknowledges requests without pretending to execute agents, workflows or tools.
 * Replace this adapter with the real NoVA adapter; do not move execution mechanics here.
 */
export class MockNoVARuntimeAdapter implements NoVARuntimeAdapter {
  readonly requests: Array<AgentExecutionRequest | WorkflowExecutionRequest | ToolInvocationRequest> = []
  private readonly runs = new Map<string, RuntimeExecutionReference>()

  async startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.accept(request, request.agentId)
  }

  async startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.accept(request, request.workflowId)
  }

  async invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference> {
    return this.accept(request, request.toolId)
  }

  async getRun(runId: string, _scope: Parameters<NoVARuntimeAdapter['getRun']>[1]): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined> {
    return this.runs.get(runId)
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalRequest> {
    return request
  }

  async resolveApproval(decision: ApprovalDecision): Promise<ApprovalDecision> {
    return decision
  }

  async negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult> {
    const supportedCapabilities = ['core.agent.run', 'core.workflow.run', 'core.tool.invoke'] as const
    const supported = request.requestedCapabilities.filter((capability): capability is typeof supportedCapabilities[number] => supportedCapabilities.includes(capability as typeof supportedCapabilities[number]))
    const rejected = request.requestedCapabilities.filter((capability) => !supported.includes(capability as typeof supported[number]))
    return { supported, rejected }
  }

  private accept(
    request: AgentExecutionRequest | WorkflowExecutionRequest | ToolInvocationRequest,
    _subjectId: string,
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