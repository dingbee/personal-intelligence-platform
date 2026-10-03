import type { UUID } from '../domain/model'

export const NOVA_RUNTIME_CONTRACT_VERSION = '1.0.0' as const

export type RuntimeExecutionState =
  | 'accepted'
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unknown'

export interface RuntimeCorrelationEnvelope {
  contractVersion: typeof NOVA_RUNTIME_CONTRACT_VERSION
  organizationId: UUID
  workspaceId?: UUID
  correlationId: UUID
  causationId?: UUID
  idempotencyKey: string
  provenanceIds?: UUID[]
  resourceVersion?: number
  definitionVersion?: number
}

export interface AgentExecutionRequest extends RuntimeCorrelationEnvelope {
  agentId: UUID
  input?: Record<string, unknown>
  contextIds?: UUID[]
  approvalId?: UUID
}

export interface WorkflowExecutionRequest extends RuntimeCorrelationEnvelope {
  workflowId: UUID
  input?: Record<string, unknown>
  approvalId?: UUID
}

export interface ToolInvocationRequest extends RuntimeCorrelationEnvelope {
  toolId: UUID
  input: Record<string, unknown>
  approvalId?: UUID
}

export interface RuntimeEvent extends RuntimeCorrelationEnvelope {
  eventId: UUID
  type: string
  occurredAt: string
  state?: RuntimeExecutionState
  runId?: UUID
  agentId?: UUID
  workflowId?: UUID
  toolId?: UUID
  approvalId?: UUID
  payload: Record<string, unknown>
}

export interface ApprovalRequest extends RuntimeCorrelationEnvelope {
  approvalId: UUID
  subjectType: string
  subjectId: UUID
  requestedBy: UUID
  reason?: string
}

export interface ApprovalDecision extends RuntimeCorrelationEnvelope {
  approvalId: UUID
  decision: 'approved' | 'rejected'
  decidedBy: UUID
  decidedAt: string
  reason?: string
}

export interface RuntimeExecutionReference {
  runId: UUID
  state: RuntimeExecutionState
  acceptedAt: string
}

export interface RuntimeExecutionResult {
  runId: UUID
  state: Exclude<RuntimeExecutionState, 'accepted' | 'queued' | 'running' | 'waiting_approval' | 'unknown'>
  output?: Record<string, unknown>
  error?: string
  completedAt?: string
}

export interface NoVARuntimeAdapter {
  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference>
  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference>
  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference>
  getRun(runId: UUID, scope: Pick<RuntimeCorrelationEnvelope, 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined>
  requestApproval(request: ApprovalRequest): Promise<ApprovalRequest>
  resolveApproval(decision: ApprovalDecision): Promise<ApprovalDecision>
}

export function assertRuntimeScope(request: RuntimeCorrelationEnvelope): void {
  if (!request.organizationId) throw new Error('NoVA runtime request requires organization scope.')
  if (!request.correlationId) throw new Error('NoVA runtime request requires correlationId.')
  if (!request.idempotencyKey) throw new Error('NoVA runtime request requires idempotencyKey.')
}

export function assertWorkspaceConsistency(request: RuntimeCorrelationEnvelope): void {
  if (request.workspaceId !== undefined && !request.workspaceId) {
    throw new Error('NoVA runtime workspace scope cannot be empty.')
  }
}