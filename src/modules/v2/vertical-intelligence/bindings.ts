import { isAutonomyLevel } from '../domain/autonomy'
import type {
  VerticalAgentDefinition,
  VerticalId,
  VerticalRegistration,
} from './types'

/**
 * V2 control-plane binding.
 *
 * This converts an externally supplied vertical contract into references that
 * a future NoVA Core invocation may validate. It never executes a tool.
 *
 * Boundary:
 *   ARRIYIA -> authorize/govern/delegate -> NoVA Core -> execute -> vertical
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
  vertical: VerticalRegistration,
  agent: VerticalAgentDefinition,
): VerticalContextContract {
  const entityIds = Array.from(new Set(agent.context.entityIds))
  const signalIds = Array.from(new Set(agent.context.signalIds))

  const knownEntities = new Set(vertical.entities.map((entity) => entity.id))
  const knownSignals = new Set(vertical.signals.map((signal) => signal.id))

  for (const entityId of entityIds) {
    if (!knownEntities.has(entityId)) {
      throw new Error('Agent context references unknown entity: ' + vertical.verticalId + '/' + entityId)
    }
  }

  for (const signalId of signalIds) {
    if (!knownSignals.has(signalId)) {
      throw new Error('Agent context references unknown signal: ' + vertical.verticalId + '/' + signalId)
    }
  }

  return {
    id: 'v2:context:' + vertical.verticalId + ':' + agent.id,
    verticalId: vertical.verticalId,
    entityIds,
    signalIds,
    memoryScopes: ['workspace:' + vertical.verticalId, 'agent:' + agent.id],
  }
}

export function bindVerticalAgentContract(
  vertical: VerticalRegistration,
  agent: VerticalAgentDefinition,
): VerticalAgentContractBinding {
  const context = buildContextContract(vertical, agent)

  const tools = agent.allowedTools.map((toolId) => {
    const definition = vertical.tools.find((tool) => tool.id === toolId)
    if (!definition) {
      throw new Error(`Vertical tool metadata is missing: ${vertical.verticalId}/${toolId}`)
    }

    return {
      id: `v2:tool:${vertical.verticalId}:${toolId}`,
      verticalId: vertical.verticalId,
      toolId,
      executionAuthority: 'nova-core' as const,
      consequential: definition.requiresApproval,
      requiresApproval: definition.requiresApproval,
    }
  })

  return {
    agentId: agent.id,
    verticalId: vertical.verticalId,
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
  vertical: VerticalRegistration,
): VerticalAgentContractBinding[] {
  return vertical.agents.map((agent) => bindVerticalAgentContract(vertical, agent))
}

/**
 * Boundary verification before a binding can be handed to NoVA Core.
 * It validates references only; it never executes anything.
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

  if (!isAutonomyLevel(binding.autonomyCeiling)) {
    errors.push('Binding contains an invalid autonomy ceiling')
  }

  if (binding.governanceRequired !== true) {
    errors.push('Governance must remain mandatory')
  }

  if (binding.approvalRequiredForConsequentialActions !== true) {
    errors.push('Consequential actions must remain approval-gated')
  }

  if (binding.executionEnabled !== false) {
    errors.push('V2 binding must not enable execution')
  }

  return errors
}
