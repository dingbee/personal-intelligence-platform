import type {
  AgentExecutionRequest,
  ApprovalDecision,
  ApprovalRequest,
  CapabilityNegotiationRequest,
  CapabilityNegotiationResult,
  NoVARuntimeAdapter,
  RuntimeCorrelationEnvelope,
  RuntimeExecutionReference,
  RuntimeExecutionResult,
  ToolInvocationRequest,
  WorkflowExecutionRequest,
} from './contracts'
import { assertRuntimeScope, assertWorkspaceConsistency } from './contracts'
import type { UUID } from '../domain/model'

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
}

export class ValidatingNoVARuntimeAdapter implements NoVARuntimeAdapter {
  constructor(private readonly delegate: NoVARuntimeAdapter) {}

  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference> {
    validateAgentExecutionRequest(request)
    return this.delegate.startAgent(request)
  }

  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference> {
    validateWorkflowExecutionRequest(request)
    return this.delegate.startWorkflow(request)
  }

  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference> {
    validateToolInvocationRequest(request)
    return this.delegate.invokeTool(request)
  }

  getRun(runId: UUID, scope: Pick<RuntimeCorrelationEnvelope, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined> {
    validateRuntimeRequest({ contractVersion: scope.contractVersion ?? '1.0.0', ...scope })
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