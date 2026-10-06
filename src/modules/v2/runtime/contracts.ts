import type { AuthorizationEnvelope } from '../agents/authorization'
import type { UUID } from '../domain/model'

export const NOVA_RUNTIME_CONTRACT_VERSION = '1.0.0' as const

/** Opaque identifiers crossing the ARRIYIA → NoVA boundary. */
export type RuntimeCapabilityId = string
export type RuntimeRunId = string
export type RuntimeApprovalId = string

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
  actorUserId?: UUID
  correlationId: UUID
  causationId?: UUID
  idempotencyKey: string
  provenanceIds?: UUID[]
  resourceVersion?: number
  definitionVersion?: number
}

export interface CapabilityNegotiationRequest extends RuntimeCorrelationEnvelope {
  requestedCapabilities: string[]
}

export interface CapabilityNegotiationResult {
  supported: string[]
  rejected: string[]
}

export interface AgentExecutionRequest extends RuntimeCorrelationEnvelope {
  agentId: RuntimeCapabilityId
  input?: Record<string, unknown>
  contextIds?: RuntimeCapabilityId[]
  approvalId?: RuntimeApprovalId
  capabilities?: string[]
}

export interface WorkflowExecutionRequest extends RuntimeCorrelationEnvelope {
  workflowId: RuntimeCapabilityId
  input?: Record<string, unknown>
  approvalId?: RuntimeApprovalId
  capabilities?: string[]
}

export interface ToolInvocationRequest extends RuntimeCorrelationEnvelope {
  toolId: RuntimeCapabilityId
  input: Record<string, unknown>
  authorization: AuthorizationEnvelope
}

export interface RuntimeEvent extends RuntimeCorrelationEnvelope {
  eventId: UUID
  type: string
  occurredAt: string
  state?: RuntimeExecutionState
  runId?: RuntimeRunId
  agentId?: RuntimeCapabilityId
  workflowId?: RuntimeCapabilityId
  toolId?: RuntimeCapabilityId
  approvalId?: RuntimeApprovalId
  payload: Record<string, unknown>
}

export interface ApprovalRequest extends RuntimeCorrelationEnvelope {
  approvalId: RuntimeApprovalId
  subjectType: string
  subjectId: RuntimeCapabilityId
  requestedBy: RuntimeCapabilityId
  reason?: string
}

export interface ApprovalDecision extends RuntimeCorrelationEnvelope {
  approvalId: RuntimeApprovalId
  decision: 'approved' | 'rejected'
  decidedBy: RuntimeCapabilityId
  decidedAt: string
  reason?: string
}

export interface RuntimeExecutionReference {
  runId: RuntimeRunId
  state: RuntimeExecutionState
  acceptedAt: string
}

export interface RuntimeExecutionResult {
  runId: RuntimeRunId
  state: Exclude<RuntimeExecutionState, 'accepted' | 'queued' | 'running' | 'waiting_approval' | 'unknown'>
  output?: Record<string, unknown>
  error?: string
  completedAt?: string
}

export interface NoVARuntimeAdapter {
  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference>
  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference>
  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference>
  getRun(
    runId: RuntimeRunId,
    scope: Pick<RuntimeCorrelationEnvelope, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>,
  ): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined>
  requestApproval(request: ApprovalRequest): Promise<ApprovalRequest>
  resolveApproval(decision: ApprovalDecision): Promise<ApprovalDecision>
  negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult>
}

export function assertRuntimeScope(request: RuntimeCorrelationEnvelope): void {
  if (request.contractVersion !== NOVA_RUNTIME_CONTRACT_VERSION) throw new Error('Unsupported NoVA runtime contract version.')
  if (!request.organizationId) throw new Error('NoVA runtime request requires organization scope.')
  if (!request.correlationId) throw new Error('NoVA runtime request requires correlationId.')
  if (!request.idempotencyKey) throw new Error('NoVA runtime request requires idempotencyKey.')
}

export function assertWorkspaceConsistency(request: RuntimeCorrelationEnvelope): void {
  if (request.workspaceId !== undefined && !request.workspaceId) {
    throw new Error('NoVA runtime workspace scope cannot be empty.')
  }
}
