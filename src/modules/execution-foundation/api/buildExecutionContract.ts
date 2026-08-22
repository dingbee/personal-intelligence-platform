import type { Action } from '@/modules/action-intelligence/action'
import type { ExecutionContract, ExecutionSource } from '@/modules/execution-foundation/execution'

export type SafeInternalCapability = 'save_action_to_notes' | 'add_action_as_workspace_objective' | 'link_action_to_workspace_objective'

export interface BuildExecutionContractParams {
  action: Action
  capability: SafeInternalCapability
  /** Required only for 'link_action_to_workspace_objective' — the real workspace_objectives.id the action is being linked to, never fabricated. */
  targetObjectiveId?: string
}

export interface ExecutionContractDraft {
  contract: ExecutionContract
  source: ExecutionSource
  actionSnapshot: Record<string, unknown>
}

/**
 * Action -> ExecutionContract, the first arrow in the Execution
 * Foundation pipeline (ACTION -> EXECUTION REQUEST). All three safe
 * internal capabilities are 'low' risk with no external side effects —
 * they only ever write to this user's own Notes/Objectives, through the
 * same hooks Action Intelligence's own UI already exposes (see
 * executeCapability.ts, which wraps those exact functions rather than
 * duplicating their logic).
 */
export function buildExecutionContract(params: BuildExecutionContractParams): ExecutionContractDraft {
  const { action, capability, targetObjectiveId } = params

  if (capability === 'link_action_to_workspace_objective' && !targetObjectiveId) {
    throw new Error('link_action_to_workspace_objective requires a targetObjectiveId.')
  }

  const target: Record<string, unknown> = capability === 'link_action_to_workspace_objective' ? { objectiveId: targetObjectiveId } : {}

  const expectedEffect =
    capability === 'save_action_to_notes'
      ? `A note titled "${action.title}" is created.`
      : capability === 'add_action_as_workspace_objective'
        ? `A new workspace objective is created from "${action.title}".`
        : `Action "${action.title}" is referenced on an existing workspace objective.`

  const contract: ExecutionContract = {
    capability,
    target,
    inputPayload: { actionId: action.id },
    expectedEffect,
    riskClassification: 'low',
    externalSideEffects: false,
  }

  const source: ExecutionSource = {
    kind: 'action',
    actionId: action.id,
    actionSource: { kind: action.source.kind, label: action.source.label, planId: action.source.planId ?? null, decisionId: action.source.decisionId ?? null },
  }

  return { contract, source, actionSnapshot: action as unknown as Record<string, unknown> }
}
