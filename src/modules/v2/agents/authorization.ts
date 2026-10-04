import { autonomyAtMost } from '../domain/autonomy'
import type { AutonomyLevel } from '../domain/autonomy'
import type { Approval, Tool, UUID } from '../domain/model'

export type AuthorizationDecision = 'authorized' | 'requires_approval' | 'denied'

export interface AuthorizationEnvelope {
  organizationId: UUID
  workspaceId: UUID
  agentId: UUID
  actionId: UUID
  toolId: UUID
  requestedAutonomy: AutonomyLevel
  agentAutonomyCeiling: AutonomyLevel
  policyMaximumAutonomy?: AutonomyLevel
  decision: AuthorizationDecision
  requiresApproval: boolean
  approvalId?: UUID
  contextIds: UUID[]
  provenanceIds: UUID[]
  correlationId: UUID
  causationId?: UUID
}

export interface AuthorizationEvaluationInput {
  organizationId: UUID
  workspaceId: UUID
  agentId: UUID
  actionId: UUID
  requestedAutonomy: AutonomyLevel
  agentAutonomyCeiling: AutonomyLevel
  policyMaximumAutonomy?: AutonomyLevel
  tool: Pick<Tool, 'id' | 'organizationId' | 'workspaceId' | 'requiresApproval'>
  approval?: Pick<Approval, 'id' | 'organizationId' | 'workspaceId' | 'subjectType' | 'subjectId' | 'decision' | 'status' | 'expiresAt'>
  contextIds?: UUID[]
  provenanceIds?: UUID[]
  correlationId: UUID
  causationId?: UUID
}

export interface AuthorizationEvaluation {
  decision: AuthorizationDecision
  reason?: string
  envelope: AuthorizationEnvelope
}

function baseEnvelope(input: AuthorizationEvaluationInput, decision: AuthorizationDecision): AuthorizationEnvelope {
  return {
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    actionId: input.actionId,
    toolId: input.tool.id,
    requestedAutonomy: input.requestedAutonomy,
    agentAutonomyCeiling: input.agentAutonomyCeiling,
    policyMaximumAutonomy: input.policyMaximumAutonomy,
    decision,
    requiresApproval: input.tool.requiresApproval === true,
    approvalId: input.approval?.id,
    contextIds: Array.from(new Set(input.contextIds ?? [])),
    provenanceIds: Array.from(new Set(input.provenanceIds ?? [])),
    correlationId: input.correlationId,
    causationId: input.causationId,
  }
}

export function evaluateAuthorizationEnvelope(input: AuthorizationEvaluationInput): AuthorizationEvaluation {
  if (!input.organizationId || !input.workspaceId || !input.agentId || !input.actionId || !input.tool.id || !input.correlationId) {
    return { decision: 'denied', reason: 'Authorization envelope is missing required governance scope.', envelope: baseEnvelope(input, 'denied') }
  }

  if (input.tool.organizationId !== input.organizationId) {
    return { decision: 'denied', reason: 'Tool organization scope does not match authorization scope.', envelope: baseEnvelope(input, 'denied') }
  }

  if (input.tool.workspaceId && input.tool.workspaceId !== input.workspaceId) {
    return { decision: 'denied', reason: 'Tool workspace scope does not match authorization scope.', envelope: baseEnvelope(input, 'denied') }
  }

  if (!autonomyAtMost(input.requestedAutonomy, input.agentAutonomyCeiling)) {
    return { decision: 'denied', reason: 'Requested autonomy exceeds the agent autonomy ceiling.', envelope: baseEnvelope(input, 'denied') }
  }

  if (input.policyMaximumAutonomy && !autonomyAtMost(input.requestedAutonomy, input.policyMaximumAutonomy)) {
    return { decision: 'denied', reason: 'Requested autonomy exceeds the applicable policy maximum autonomy.', envelope: baseEnvelope(input, 'denied') }
  }

  if (input.tool.requiresApproval === true) {
    if (!input.approval) {
      return { decision: 'requires_approval', reason: 'Consequential action requires an approval reference.', envelope: baseEnvelope(input, 'requires_approval') }
    }

    if (input.approval.organizationId !== input.organizationId || input.approval.workspaceId !== input.workspaceId) {
      return { decision: 'denied', reason: 'Approval scope does not match authorization scope.', envelope: baseEnvelope(input, 'denied') }
    }

    if (input.approval.subjectType !== 'action' || input.approval.subjectId !== input.actionId) {
      return { decision: 'denied', reason: 'Approval does not authorize this exact action.', envelope: baseEnvelope(input, 'denied') }
    }

    if (input.approval.status !== 'active' || input.approval.decision !== 'approved' || (input.approval.expiresAt && Date.parse(input.approval.expiresAt) <= Date.now())) {
      return { decision: 'denied', reason: 'Approval is not active and approved.', envelope: baseEnvelope(input, 'denied') }
    }
  }

  return { decision: 'authorized', envelope: baseEnvelope(input, 'authorized') }
}
