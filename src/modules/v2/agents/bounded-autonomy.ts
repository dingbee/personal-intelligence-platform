import type { AutonomyLevel } from '../domain/autonomy'
import { autonomyAtMost } from '../domain/autonomy'
import type { Approval, Tool } from '../domain/model'

export interface AutonomyEvaluation {
  allowed: boolean
  requested: AutonomyLevel
  ceiling: AutonomyLevel
  reason?: string
}

export function evaluateAutonomy(
  requested: AutonomyLevel,
  ceiling: AutonomyLevel,
): AutonomyEvaluation {
  const allowed = autonomyAtMost(requested, ceiling)
  return {
    allowed,
    requested,
    ceiling,
    ...(allowed ? {} : {
      reason: 'Requested autonomy exceeds the agent autonomy ceiling.',
    }),
  }
}

export interface ActionAuthorizationInput {
  requestedAutonomy: AutonomyLevel
  agentAutonomyCeiling: AutonomyLevel
  policyMaximumAutonomy?: AutonomyLevel
  tool: Pick<Tool, 'requiresApproval'>
  approval?: Pick<Approval, 'decision'>
}

export interface ActionAuthorizationResult {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
}

export function evaluateActionAuthorization(
  input: ActionAuthorizationInput,
): ActionAuthorizationResult {
  const autonomy = evaluateAutonomy(input.requestedAutonomy, input.agentAutonomyCeiling)
  if (!autonomy.allowed) {
    return {
      allowed: false,
      requiresApproval: Boolean(input.tool.requiresApproval),
      reason: autonomy.reason,
    }
  }

  if (
    input.policyMaximumAutonomy &&
    !autonomyAtMost(input.requestedAutonomy, input.policyMaximumAutonomy)
  ) {
    return {
      allowed: false,
      requiresApproval: Boolean(input.tool.requiresApproval),
      reason: 'Requested autonomy exceeds the applicable policy maximum autonomy.',
    }
  }

  const requiresApproval = input.tool.requiresApproval === true
  if (requiresApproval && input.approval?.decision !== 'approved') {
    return {
      allowed: false,
      requiresApproval: true,
      reason: 'Consequential action requires an approved governance decision before execution.',
    }
  }

  return {
    allowed: true,
    requiresApproval: false,
  }
}
