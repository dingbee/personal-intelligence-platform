import type { AutonomyLevel } from '../domain/autonomy'

export const NOVA_RUNTIME_MANIFEST_VERSION = '1.0.0' as const

export interface NoVAPluginEntityContract {
  id: string
  label: string
  description: string
}

export interface NoVAPluginSignalContract {
  id: string
  label: string
  description: string
  entityIds?: string[]
}

export interface NoVAPluginToolContract {
  id: string
  description?: string
  requiresApproval: boolean
}

export interface NoVAPluginAgentContract {
  id: string
  name: string
  description: string
  intelligenceKind: 'guest' | 'operations' | 'revenue' | 'inventory' | 'procurement' | 'sales' | 'executive' | 'custom'
  capabilities: string[]
  allowedTools: string[]
  context: {
    entityIds: string[]
    signalIds: string[]
  }
  autonomy: AutonomyLevel
}

/**
 * External plugin contract accepted by ARRIYIA as declarative metadata.
 *
 * The plugin implementation is owned by the external product and registered
 * with NoVA Core. ARRIYIA stores/uses only the contract required for
 * governance and delegation; it does not register or execute the plugin.
 */
export interface NoVAPluginContract {
  pluginId: string
  displayName: string
  contractVersion: string
  capabilities: string[]
  entities: NoVAPluginEntityContract[]
  signals: NoVAPluginSignalContract[]
  tools: NoVAPluginToolContract[]
  agents: NoVAPluginAgentContract[]
  governanceRequirements: {
    approvalForConsequentialActions: true
  }
  executionAuthority: 'nova-core'
}

export interface NoVARuntimeToolManifest {
  id: string
  pluginId: string
  description?: string
  requiresApproval: boolean
}

export interface NoVARuntimeAgentManifest {
  id: string
  pluginId: string
  name: string
  description: string
  intelligenceKind: NoVAPluginAgentContract['intelligenceKind']
  capabilities: string[]
  toolIds: string[]
  contextEntityIds: string[]
  contextSignalIds: string[]
  autonomyCeiling: AutonomyLevel
}

export interface NoVARuntimeManifest {
  manifestVersion: typeof NOVA_RUNTIME_MANIFEST_VERSION
  contractVersion: string
  plugin: {
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
 * Compile declarative plugin metadata into a NoVA-facing runtime manifest.
 *
 * This compiler carries identity/capability/governance metadata only. It does
 * not execute anything and does not register the plugin in NoVA Core.
 */
export function compilePluginContractToNoVARuntimeManifest(
  registration: NoVAPluginContract,
): NoVARuntimeManifest {
  if (!registration.pluginId) throw new Error('Plugin contract requires pluginId.')
  if (!registration.contractVersion) throw new Error('Plugin contract requires contractVersion.')
  if (registration.executionAuthority !== 'nova-core') {
    throw new Error('Plugin contract execution authority must remain nova-core.')
  }
  if (registration.governanceRequirements.approvalForConsequentialActions !== true) {
    throw new Error('Consequential plugin actions must remain approval-gated.')
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
    plugin: {
      id: registration.pluginId,
      displayName: registration.displayName,
      capabilities: [...registration.capabilities],
      executionAuthority: registration.executionAuthority,
    },
    tools: registration.tools.map((tool) => ({
      id: tool.id,
      pluginId: registration.pluginId,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
    })),
    agents: registration.agents.map((agent) => ({
      id: agent.id,
      pluginId: registration.pluginId,
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
