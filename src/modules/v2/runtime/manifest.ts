import type { AutonomyLevel } from '../domain/autonomy'
import type {
  VerticalAgentDefinition,
  VerticalRegistration,
} from '../vertical-intelligence/types'

export const NOVA_RUNTIME_MANIFEST_VERSION = '1.0.0' as const

export interface NoVARuntimeToolManifest {
  id: string
  verticalId: string
  description?: string
  requiresApproval: boolean
}

export interface NoVARuntimeAgentManifest {
  id: string
  verticalId: string
  name: string
  description: string
  intelligenceKind: VerticalAgentDefinition['intelligenceKind']
  capabilities: string[]
  toolIds: string[]
  contextEntityIds: string[]
  contextSignalIds: string[]
  autonomyCeiling: AutonomyLevel
}

export interface NoVARuntimeManifest {
  manifestVersion: typeof NOVA_RUNTIME_MANIFEST_VERSION
  contractVersion: string
  vertical: {
    id: string
    displayName: string
    capabilities: string[]
    executionAuthority: 'nova-core'
  }
  tools: NoVARuntimeToolManifest[]
  agents: NoVARuntimeAgentManifest[]
  governance: {
    approvalForConsequentialActions: true
  }
}

/**
 * Compile declarative ARRIYIA metadata into a NoVA-facing runtime manifest.
 *
 * This compiler carries identity/capability/governance metadata only. It does
 * not execute anything and must not import a vertical product implementation.
 */
export function compileVerticalRegistrationToNoVARuntimeManifest(
  registration: VerticalRegistration,
): NoVARuntimeManifest {
  if (!registration.verticalId) throw new Error('Vertical contract requires verticalId.')
  if (!registration.contractVersion) throw new Error('Vertical contract requires contractVersion.')
  if (registration.executionAuthority !== 'nova-core') {
    throw new Error('Vertical contract execution authority must remain nova-core.')
  }
  if (registration.governanceRequirements.approvalForConsequentialActions !== true) {
    throw new Error('Consequential vertical actions must remain approval-gated.')
  }

  const entityIds = new Set(registration.entities.map((entity) => entity.id))
  const signalIds = new Set(registration.signals.map((signal) => signal.id))
  const toolIds = new Set(registration.tools.map((tool) => tool.id))

  for (const signal of registration.signals) {
    for (const entityId of signal.entityIds ?? []) {
      if (!entityIds.has(entityId)) {
        throw new Error(`Signal ${signal.id} references unknown entity ${entityId}.`)
      }
    }
  }

  for (const agent of registration.agents) {
    for (const entityId of agent.context.entityIds) {
      if (!entityIds.has(entityId)) {
        throw new Error(`Agent ${agent.id} references unknown entity ${entityId}.`)
      }
    }
    for (const signalId of agent.context.signalIds) {
      if (!signalIds.has(signalId)) {
        throw new Error(`Agent ${agent.id} references unknown signal ${signalId}.`)
      }
    }
    for (const toolId of agent.allowedTools) {
      if (!toolIds.has(toolId)) {
        throw new Error(`Agent ${agent.id} references unknown tool ${toolId}.`)
      }
    }
  }

  return {
    manifestVersion: NOVA_RUNTIME_MANIFEST_VERSION,
    contractVersion: registration.contractVersion,
    vertical: {
      id: registration.verticalId,
      displayName: registration.displayName,
      capabilities: [...registration.capabilities],
      executionAuthority: registration.executionAuthority,
    },
    tools: registration.tools.map((tool) => ({
      id: tool.id,
      verticalId: registration.verticalId,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
    })),
    agents: registration.agents.map((agent) => ({
      id: agent.id,
      verticalId: registration.verticalId,
      name: agent.name,
      description: agent.description,
      intelligenceKind: agent.intelligenceKind,
      capabilities: [...agent.capabilities],
      toolIds: [...agent.allowedTools],
      contextEntityIds: [...agent.context.entityIds],
      contextSignalIds: [...agent.context.signalIds],
      autonomyCeiling: agent.autonomy,
    })),
    governance: {
      approvalForConsequentialActions: true,
    },
  }
}
