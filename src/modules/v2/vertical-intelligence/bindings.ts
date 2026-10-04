import { isAutonomyLevel } from '../domain/autonomy'
import type {
  VerticalAgentDefinition,
  VerticalId,
  VerticalIntelligenceDefinition,
} from './types'

/**
 * V2-12 Slice 3 — Context & Tool Contract Binding
 *
 * This is a control-plane binding manifest, not an execution registry.
 * It converts a vertical agent's domain declaration into the references
 * that a future NoVA Core invocation may validate.
 *
 * Invariants:
 * - no tool invocation occurs here
 * - no credentials or provider configuration live here
 * - vertical autonomy is only a ceiling
 * - consequential execution remains behind V2 governance + approval policy
 * - NoVA Core remains the execution authority
 */

export interface VerticalContextContract {
  id: string
  verticalId: VerticalId
  entityIds: string[]
  signalIds: string[]
  memoryScopes: string[]
}

export interface VerticalToolContract {
  id: string
  verticalId: VerticalId
  toolId: string
  executionAuthority: 'nova-core'
  consequential: boolean
  requiresApproval: boolean
}

export interface VerticalAgentContractBinding {
  agentId: string
  verticalId: VerticalId
  context: VerticalContextContract
  tools: VerticalToolContract[]
  autonomyCeiling: VerticalAgentDefinition['autonomy']
  governanceRequired: true
  approvalRequiredForConsequentialActions: true
  executionAuthority: 'nova-core'
  executionEnabled: false
}

function buildContextContract(
  vertical: VerticalIntelligenceDefinition,
  agent: VerticalAgentDefinition,
): VerticalContextContract {
  const entityIds = Array.from(new Set(agent.context.entityIds))
  const signalIds = Array.from(new Set(agent.context.signalIds))

  const knownEntities = new Set(vertical.entities.map((entity) => entity.id))
  const knownSignals = new Set(vertical.signals.map((signal) => signal.id))

  for (const entityId of entityIds) {
    if (!knownEntities.has(entityId)) {
      throw new Error('Agent context references unknown entity: ' + vertical.id + '/' + entityId)
    }
  }

  for (const signalId of signalIds) {
    if (!knownSignals.has(signalId)) {
      throw new Error('Agent context references unknown signal: ' + vertical.id + '/' + signalId)
    }
  }

  return {
    id: 'v2:context:' + vertical.id + ':' + agent.id,
    verticalId: vertical.id,
    entityIds,
    signalIds,
    memoryScopes: ['workspace:' + vertical.id, 'agent:' + agent.id],
  }
}
export function bindVerticalAgentContract(
  vertical: VerticalIntelligenceDefinition,
  agent: VerticalAgentDefinition,
): VerticalAgentContractBinding {
  const context = buildContextContract(vertical, agent)

  const tools = agent.allowedTools.map((toolId) => {
    const definition = vertical.tools.find((tool) => tool.id === toolId)
    if (!definition) throw new Error(`Vertical tool metadata is missing: ${vertical.id}/${toolId}`)
    return {
      id: `v2:tool:${vertical.id}:${toolId}`,
      verticalId: vertical.id,
      toolId,
      executionAuthority: 'nova-core' as const,
      consequential: definition.requiresApproval,
      requiresApproval: definition.requiresApproval,
    }
  })

  return {
    agentId: agent.id,
    verticalId: vertical.id,
    context,
    tools,
    autonomyCeiling: agent.autonomy,
    governanceRequired: true,
    approvalRequiredForConsequentialActions: true,
    executionAuthority: 'nova-core',
    executionEnabled: false,
  }
}

export function bindVerticalAgents(
  vertical: VerticalIntelligenceDefinition,
): VerticalAgentContractBinding[] {
  return vertical.agents.map((agent) => bindVerticalAgentContract(vertical, agent))
}

/**
 * Boundary verification used before a binding can be handed to a runtime.
 * It intentionally validates references only; it never executes anything.
 */
export function validateVerticalAgentContractBinding(
  binding: VerticalAgentContractBinding,
): string[] {
  const errors: string[] = []

  if (binding.verticalId !== binding.context.verticalId) {
    errors.push('Context contract crosses vertical boundary')
  }

  for (const tool of binding.tools) {
    if (tool.verticalId !== binding.verticalId) {
      errors.push(`Tool contract crosses vertical boundary: ${tool.toolId}`)
    }

    if (tool.executionAuthority !== 'nova-core') {
      errors.push(`Tool has invalid execution authority: ${tool.toolId}`)
    }

    if (tool.consequential !== tool.requiresApproval) {
      errors.push(`Tool approval metadata is inconsistent: ${tool.toolId}`)
    }
  }

  if (!isAutonomyLevel(binding.autonomyCeiling)) errors.push('Binding contains an invalid autonomy ceiling')

  if (binding.governanceRequired !== true) {
    errors.push('Governance must remain mandatory')
  }

  if (binding.approvalRequiredForConsequentialActions !== true) {
    errors.push('Consequential actions must remain approval-gated')
  }

  if (binding.executionEnabled !== false) {
    errors.push('V2-12 binding must not enable execution')
  }

  return errors
}
