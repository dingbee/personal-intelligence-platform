import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import type { Agent, AgentDefinition, Organization, Policy, Tool, Workspace, WorkflowDefinition } from '../domain/model'
import { createWorkflow, setWorkflowStatus, updateWorkflowDefinition, validateWorkflowDefinition } from './service'

const metadata = { createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z' }

function seed() {
  const store = new V2ControlPlaneStore()
  const organization: Organization = { id: 'org-1', organizationId: 'org-1', name: 'Nolmark', slug: 'nolmark', status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const workspace: Workspace = { id: 'ws-1', organizationId: 'org-1', name: 'ARRIYIA', slug: 'arriyia', status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const tool: Tool = { id: 'tool-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research', inputSchema: {}, capability: 'research', requiredPermissions: [], status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const policy: Policy = { id: 'policy-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Policy', effect: 'allow', rules: [], status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  const agentDefinition: AgentDefinition = { version: 1, systemPurpose: 'Research.', capabilities: ['research'], toolIds: ['tool-1'], memoryScopes: ['workspace'], policyIds: ['policy-1'] }
  const agent: Agent = { id: 'agent-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research Agent', definition: agentDefinition, status: 'active', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  store.save('organization', organization); store.save('workspace', workspace); store.save('tool', tool); store.save('policy', policy); store.save('agent', agent)
  return store
}

const definition: WorkflowDefinition = {
  version: 1, trigger: { type: 'manual' },
  nodes: [
    { id: 'understand', type: 'understand', name: 'Understand context', config: {}, next: ['agent'] },
    { id: 'agent', type: 'agent', name: 'Research', config: { agentId: 'agent-1' }, next: ['condition'] },
    { id: 'condition', type: 'condition', name: 'Check result', config: { expression: 'result.ready == true' }, next: [] },
  ],
}

describe('V2 workflow studio', () => {
  it('validates scoped agent dependencies and graph references', () => {
    const store = seed()
    expect(validateWorkflowDefinition(store, 'ws-1', definition)).toEqual({ valid: true })
    expect(createWorkflow(store, { id: 'workflow-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research flow', definition }, metadata).status).toBe('draft')
  })
  it('rejects missing graph references', () => {
    const store = seed()
    expect(validateWorkflowDefinition(store, 'ws-1', { ...definition, nodes: [{ ...definition.nodes[0], next: ['missing'] }] }).valid).toBe(false)
  })
  it('requires increasing definition versions', () => {
    const store = seed()
    createWorkflow(store, { id: 'workflow-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research flow', definition }, metadata)
    expect(() => updateWorkflowDefinition(store, 'workflow-1', definition, metadata)).toThrow(/version must increase/)
    expect(updateWorkflowDefinition(store, 'workflow-1', { ...definition, version: 2 }, { updatedAt: '2026-10-03T01:00:00Z' }).status).toBe('draft')
  })
  it('blocks activation after an agent becomes inactive', () => {
    const store = seed()
    const workflow = createWorkflow(store, { id: 'workflow-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Research flow', definition }, metadata)
    store.replace('agent', { ...store.get('agent', 'agent-1')!, status: 'paused' })
    expect(() => setWorkflowStatus(store, workflow.id, 'active', { updatedAt: '2026-10-03T02:00:00Z' })).toThrow(/agent.*is not active/)
  })
})
