import { createRegistry, type Registry } from '@/modules/core/registry'
import type { Agent, AgentDefinition, Policy, ResourceMetadata, Tool, UUID } from '../domain/model'
import { V2ControlPlaneStore } from '../control-plane/store'

type AgentMetadata = Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>

function assertDefinition(store: V2ControlPlaneStore, workspaceId: UUID, definition: AgentDefinition): void {
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error('V2 agent definition version must be a positive integer.')
  if (!definition.systemPurpose.trim()) throw new Error('V2 agent requires a system purpose.')
  if (new Set(definition.capabilities).size !== definition.capabilities.length) throw new Error('V2 agent capabilities must be unique.')
  if (new Set(definition.toolIds).size !== definition.toolIds.length) throw new Error('V2 agent tool references must be unique.')
  if (new Set(definition.policyIds).size !== definition.policyIds.length) throw new Error('V2 agent policy references must be unique.')

  for (const toolId of definition.toolIds) {
    const tool = store.get('tool', toolId)
    if (!tool) throw new Error('V2 agent tool "' + toolId + '" does not exist.')
    if (tool.workspaceId && tool.workspaceId !== workspaceId) throw new Error('V2 agent cannot reference a tool from another workspace.')
  }

  for (const policyId of definition.policyIds) {
    const policy = store.get('policy', policyId)
    if (!policy) throw new Error('V2 agent policy "' + policyId + '" does not exist.')
    if (policy.workspaceId && policy.workspaceId !== workspaceId) throw new Error('V2 agent cannot reference a policy from another workspace.')
  }
}

export type AgentValidationResult = { valid: true } | { valid: false; reason: string }

export function validateAgentDefinition(store: V2ControlPlaneStore, workspaceId: UUID, definition: AgentDefinition): AgentValidationResult {
  try {
    assertDefinition(store, workspaceId, definition)
    return { valid: true }
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'V2 agent definition is invalid.' }
  }
}

export function createAgent(
  store: V2ControlPlaneStore,
  input: { id: UUID; organizationId: UUID; workspaceId: UUID; name: string; description?: string; definition: AgentDefinition },
  metadata: AgentMetadata,
): Agent {
  assertDefinition(store, input.workspaceId, input.definition)
  const agent: Agent = {
    id: input.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
    definition: input.definition,
    status: 'draft',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }
  store.save('agent', agent)
  return agent
}

export function updateAgent(
  store: V2ControlPlaneStore,
  agentId: UUID,
  input: { name?: string; description?: string },
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Agent {
  const agent = store.get('agent', agentId)
  if (!agent) throw new Error('V2 agent does not exist.')
  const updated: Agent = { ...agent, name: input.name ?? agent.name, description: input.description ?? agent.description, updatedAt: metadata.updatedAt }
  store.replace('agent', updated)
  return updated
}

export function updateAgentDefinition(
  store: V2ControlPlaneStore,
  agentId: UUID,
  definition: AgentDefinition,
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Agent {
  const agent = store.get('agent', agentId)
  if (!agent) throw new Error('V2 agent does not exist.')
  if (definition.version <= agent.definition.version) throw new Error('V2 agent definition version must increase when the definition changes.')
  assertDefinition(store, agent.workspaceId, definition)
  const updated: Agent = { ...agent, definition, status: 'draft', updatedAt: metadata.updatedAt }
  store.replace('agent', updated)
  return updated
}

export function setAgentStatus(
  store: V2ControlPlaneStore,
  agentId: UUID,
  status: 'draft' | 'active' | 'paused' | 'archived',
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Agent {
  const agent = store.get('agent', agentId)
  if (!agent) throw new Error('V2 agent does not exist.')

  if (status === 'active') {
    assertDefinition(store, agent.workspaceId, agent.definition)
  }

  const updated: Agent = { ...agent, status, updatedAt: metadata.updatedAt }
  store.replace('agent', updated)
  return updated
}

export interface AgentCatalogue {
  register(agent: Agent): void
  get(id: UUID): Agent | undefined
  list(): Agent[]
  active(): Agent[]
}

export function createAgentCatalogue(): AgentCatalogue {
  const registry: Registry<Agent> = createRegistry<Agent>()
  return {
    register(agent) { registry.register(agent) },
    get(id) { return registry.get(id) },
    list() { return registry.list() },
    active() { return registry.list().filter((agent) => agent.status === 'active') },
  }
}

export function getAgentDependencies(store: V2ControlPlaneStore, agent: Agent): { tools: Tool[]; policies: Policy[] } {
  return {
    tools: agent.definition.toolIds.map((id) => store.get('tool', id)).filter((tool): tool is Tool => Boolean(tool)),
    policies: agent.definition.policyIds.map((id) => store.get('policy', id)).filter((policy): policy is Policy => Boolean(policy)),
  }
}
