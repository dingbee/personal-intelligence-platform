import type { AgentExecutionRequest, ApprovalDecision, ApprovalRequest, CapabilityNegotiationRequest, CapabilityNegotiationResult, NoVARuntimeAdapter, RuntimeCorrelationEnvelope, RuntimeExecutionReference, RuntimeExecutionResult, ToolInvocationRequest, WorkflowExecutionRequest } from './contracts'
import { assertRuntimeScope, assertWorkspaceConsistency } from './contracts'
import type { UUID } from '../domain/model'
import { autonomyAtMost, isAutonomyLevel } from '../domain/autonomy'

export function validateRuntimeRequest(request: RuntimeCorrelationEnvelope): void {
  assertRuntimeScope(request)
  assertWorkspaceConsistency(request)
}

export function validateAgentExecutionRequest(request: AgentExecutionRequest): void {
  validateRuntimeRequest(request)
  if (!request.agentId) throw new Error('NoVA agent execution requires agentId.')
}

export function validateWorkflowExecutionRequest(request: WorkflowExecutionRequest): void {
  validateRuntimeRequest(request)
  if (!request.workflowId) throw new Error('NoVA workflow execution requires workflowId.')
}

export function validateToolInvocationRequest(request: ToolInvocationRequest): void {
  validateRuntimeRequest(request)
  if (!request.toolId) throw new Error('NoVA tool invocation requires toolId.')
  if (!request.input) throw new Error('NoVA tool invocation requires input.')
  if (!request.authorization) throw new Error('NoVA tool invocation requires an authorization envelope.')
  if (!request.authorization.agentId || !request.authorization.actionId) throw new Error('Authorization envelope requires agent and action identity.')
  if (!isAutonomyLevel(request.authorization.requestedAutonomy) || !isAutonomyLevel(request.authorization.agentAutonomyCeiling)) throw new Error('Authorization envelope contains an invalid autonomy level.')
  if (!autonomyAtMost(request.authorization.requestedAutonomy, request.authorization.agentAutonomyCeiling)) throw new Error('Authorization envelope exceeds the agent autonomy ceiling.')
  if (request.authorization.policyMaximumAutonomy && !autonomyAtMost(request.authorization.requestedAutonomy, request.authorization.policyMaximumAutonomy)) throw new Error('Authorization envelope exceeds the policy autonomy ceiling.')
  if (request.authorization.requiresApproval && !request.authorization.approvalId) throw new Error('Authorized consequential invocation requires an approval reference.')
  if (request.authorization.decision !== 'authorized') throw new Error('NoVA tool invocation requires an authorized governance envelope.')
  if (request.authorization.toolId !== request.toolId) throw new Error('Authorization envelope tool does not match invocation tool.')
  if (request.authorization.organizationId !== request.organizationId) throw new Error('Authorization envelope organization does not match runtime scope.')
  if (request.authorization.workspaceId !== request.workspaceId) throw new Error('Authorization envelope workspace does not match runtime scope.')
  if (request.authorization.correlationId !== request.correlationId) throw new Error('Authorization envelope correlationId does not match runtime request.')
}

export class ValidatingNoVARuntimeAdapter implements NoVARuntimeAdapter {
  private readonly delegate: NoVARuntimeAdapter

  constructor(delegate: NoVARuntimeAdapter) {
    this.delegate = delegate
  }
  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference> { validateAgentExecutionRequest(request); return this.delegate.startAgent(request) }
  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference> { validateWorkflowExecutionRequest(request); return this.delegate.startWorkflow(request) }
  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference> { validateToolInvocationRequest(request); return this.delegate.invokeTool(request) }
  getRun(runId: UUID, scope: Pick<RuntimeCorrelationEnvelope, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined> {
    validateRuntimeRequest(scope)
    if (!runId) throw new Error('NoVA runtime lookup requires runId.')
    return this.delegate.getRun(runId, scope)
  }
  requestApproval(request: ApprovalRequest): Promise<ApprovalRequest> {
    validateRuntimeRequest(request)
    if (!request.approvalId) throw new Error('NoVA approval request requires approvalId.')
    return this.delegate.requestApproval(request)
  }
  resolveApproval(decision: ApprovalDecision): Promise<ApprovalDecision> {
    validateRuntimeRequest(decision)
    if (!decision.approvalId) throw new Error('NoVA approval decision requires approvalId.')
    return this.delegate.resolveApproval(decision)
  }
  negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult> {
    validateRuntimeRequest(request)
    return this.delegate.negotiateCapabilities(request)
  }
}