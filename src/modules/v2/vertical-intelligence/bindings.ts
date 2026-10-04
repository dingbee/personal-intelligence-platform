import { isAutonomyLevel } from '../domain/autonomy'
import type {
  VerticalAgentDefinition,
  VerticalId,
  VerticalIntelligenceDefinition,
  VerticalToolDefinition,
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

const CONSEQUENTIAL_TOOL_PATTERNS = [
  'tasks',
  'purchasing',
  'purchase-orders',
  'payments',
  'kitchen',
]

function isConsequentialTool(toolId: string): boolean {
  return CONSEQUENTIAL_TOOL_PATTERNS.some((pattern) => toolId === pattern)
}

function buildContextContract(
  vertical: VerticalIntelligenceDefinition,
  agent: VerticalAgentDefinition,
): VerticalContextContract {
  const entityIds = new Set<string>()
  const signalIds = new Set<string>()

  // The agent's declared intelligence kind is the primary domain anchor.
  // Signals without explicit entity links are intentionally included only
  // when their description is relevant to the agent's declared capability.
  const capabilityText = [
    agent.intelligenceKind,
    ...agent.capabilities,
  ].join(' ').toLowerCase()

  for (const signal of vertical.signals) {
    const signalText = [
      signal.id,
      signal.label,
      signal.description,
    ].join(' ').toLowerCase()

    if (
      signal.entityIds?.some((entityId) => entityTextMatches(vertical, entityId, capabilityText)) ||
      signalText.split(/[^a-z0-9-]+/).some((token) => token && capabilityText.includes(token))
    ) {
      signalIds.add(signal.id)
      signal.entityIds?.forEach((entityId) => entityIds.add(entityId))
    }
  }

  // Every binding must at least expose the vertical's explicit domain entities
  // that can be inferred from its tool surface. This remains deterministic.
  for (const entity of vertical.entities) {
    const entityText = [entity.id, entity.label, entity.description]
      .join(' ')
      .toLowerCase()

    if (
      agent.allowedTools.some((tool) => entityText.includes(tool.replace(/-/g, ' '))) ||
      capabilityText.includes(entity.id.replace(/-/g, ' '))
    ) {
      entityIds.add(entity.id)
    }
  }

  // Do not manufacture an empty context for a valid agent. The vertical
  // remains the hard tenant/domain boundary.
  if (entityIds.size === 0) {
    vertical.entities.forEach((entity) => entityIds.add(entity.id))
  }

  return {
    id: `v2:context:${vertical.id}:${agent.id}`,
    verticalId: vertical.id,
    entityIds: Array.from(entityIds),
    signalIds: Array.from(signalIds),
    memoryScopes: [
      `workspace:${vertical.id}`,
      `agent:${agent.id}`,
    ],
  }
}

function entityTextMatches(
  vertical: VerticalIntelligenceDefinition,
  entityId: string,
  capabilityText: string,
): boolean {
  const entity = vertical.entities.find((candidate) => candidate.id === entityId)
  if (!entity) return false

  return [entity.id, entity.label]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .some((token) => token.length > 2 && capabilityText.includes(token))
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
