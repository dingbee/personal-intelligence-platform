import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import type { AgentDefinition, Organization, Policy, Tool, Workspace } from '../domain/model'
import { createAgent, createAgentCatalogue, getAgentDependencies, setAgentStatus, updateAgentDefinition, validateAgentDefinition } from './service'

const metadata = { createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z' }

function seed() {
  const store = new V2ControlPlaneStore()
  const organization: Organization = { id: 'org-1', organizationId: 'org-1', name: 'Nolmark', slug: 'nolmark', status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const workspace: Workspace = { id: 'ws-1', organizationId: 'org-1', name: 'ARRIYIA', slug: 'arriyia', status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const tool: Tool = { id: 'tool-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research', inputSchema: {}, capability: 'research', requiredPermissions: [], status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const policy: Policy = { id: 'policy-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research policy', effect: 'allow', rules: [], status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  store.save('organization', organization)
  store.save('workspace', workspace)
  store.save('tool', tool)
  store.save('policy', policy)
  return store
}

const definition: AgentDefinition = {
  version: 1,
  systemPurpose: 'Research and synthesize governed intelligence.',
  capabilities: ['research', 'synthesis'],
  toolIds: ['tool-1'],
  memoryScopes: ['workspace', 'project'],
  policyIds: ['policy-1'],
}

describe('V2 agent management', () => {
  it('creates agents only when dependencies are valid and scoped', () => {
    const store = seed()
    const agent = createAgent(store, { id: 'agent-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research Agent', definition }, metadata)
    expect(agent.status).toBe('draft')
    expect(agent.definition.version).toBe(1)
    expect(validateAgentDefinition(store, 'ws-1', definition)).toEqual({ valid: true })
  })

  it('rejects cross-workspace tool dependencies', () => {
    const store = seed()
    const foreignTool: Tool = { id: 'tool-2', organizationId: 'org-1', workspaceId: 'ws-2', name: 'Foreign', inputSchema: {}, capability: 'foreign', requiredPermissions: [], status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
    store.save('tool', foreignTool)
    const result = validateAgentDefinition(store, 'ws-1', { ...definition, toolIds: ['tool-2'] })
    expect(result.valid).toBe(false)
  })

  it('requires monotonically increasing definition versions', () => {
    const store = seed()
    createAgent(store, { id: 'agent-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research Agent', definition }, metadata)
    expect(() => updateAgentDefinition(store, 'agent-1', definition, metadata)).toThrow(/version must increase/)
    const updated = updateAgentDefinition(store, 'agent-1', { ...definition, version: 2, capabilities: ['research', 'synthesis', 'planning'] }, { updatedAt: '2026-10-03T01:00:00Z' })
    expect(updated.definition.version).toBe(2)
    expect(updated.status).toBe('draft')
  })

  it('reuses the existing core registry for the agent catalogue', () => {
    const store = seed()
    const agent = createAgent(store, { id: 'agent-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research Agent', definition }, metadata)
    const catalogue = createAgentCatalogue()
    catalogue.register(agent)
    expect(catalogue.list()).toHaveLength(1)
    expect(catalogue.active()).toHaveLength(0)
    setAgentStatus(store, 'agent-1', 'active', { updatedAt: '2026-10-03T01:00:00Z' })
    catalogue.register({ ...agent, status: 'active', updatedAt: '2026-10-03T01:00:00Z' })
    expect(catalogue.active()).toHaveLength(1)
  })

  it('resolves only existing agent dependencies', () => {
    const store = seed()
    const agent = createAgent(store, { id: 'agent-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research Agent', definition }, metadata)
    const dependencies = getAgentDependencies(store, agent)
    expect(dependencies.tools.map((item) => item.id)).toEqual(['tool-1'])
    expect(dependencies.policies.map((item) => item.id)).toEqual(['policy-1'])
  })
})
