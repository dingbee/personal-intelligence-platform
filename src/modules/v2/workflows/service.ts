import type { Agent, Approval, ResourceMetadata, Tool, UUID, Workflow, WorkflowDefinition, WorkflowNode } from '../domain/model'
import { V2ControlPlaneStore } from '../control-plane/store'

type WorkflowMetadata = Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>
const NODE_TYPES = new Set<WorkflowNode['type']>(['understand', 'agent', 'tool', 'condition', 'approval', 'action', 'verify'])

function assertDefinition(store: V2ControlPlaneStore, workspaceId: UUID, definition: WorkflowDefinition): void {
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error('V2 workflow definition version must be a positive integer.')
  if (definition.nodes.length === 0) throw new Error('V2 workflow requires at least one node.')
  const ids = new Set<string>()
  for (const node of definition.nodes) {
    if (!node.id.trim()) throw new Error('V2 workflow nodes require an id.')
    if (ids.has(node.id)) throw new Error('V2 workflow node ids must be unique.')
    ids.add(node.id)
    if (!node.name.trim()) throw new Error('V2 workflow nodes require a name.')
    if (!NODE_TYPES.has(node.type)) throw new Error('V2 workflow contains an unsupported node type.')
  }
  for (const node of definition.nodes) {
    for (const next of node.next ?? []) {
      if (!ids.has(next)) throw new Error('V2 workflow node "' + node.id + '" references a missing next node "' + next + '".')
    }
    if (node.type === 'agent') {
      const agentId = typeof node.config.agentId === 'string' ? node.config.agentId : undefined
      if (!agentId) throw new Error('V2 agent nodes require config.agentId.')
      const organizationId = store.get('workspace', workspaceId)?.organizationId ?? ''
      const agent = store.getScoped('agent', agentId, { organizationId, workspaceId })
      if (!agent) throw new Error('V2 workflow agent "' + agentId + '" does not exist in the active workspace.')
      if (agent.workspaceId !== workspaceId) throw new Error('V2 workflow cannot reference an agent from another workspace.')
      if (agent.status !== 'active') throw new Error('V2 workflow agent "' + agentId + '" is not active.')
    }
    if (node.type === 'tool') {
      const toolId = typeof node.config.toolId === 'string' ? node.config.toolId : undefined
      if (!toolId) throw new Error('V2 tool nodes require config.toolId.')
      const organizationId = store.get('workspace', workspaceId)?.organizationId ?? ''
      const tool = store.getScoped('tool', toolId, { organizationId, workspaceId })
      if (!tool) throw new Error('V2 workflow tool "' + toolId + '" does not exist in the active workspace.')
      if (tool.workspaceId && tool.workspaceId !== workspaceId) throw new Error('V2 workflow cannot reference a tool from another workspace.')
      if (tool.status !== 'active') throw new Error('V2 workflow tool "' + toolId + '" is not active.')
    }
    if (node.type === 'approval' && node.config.approvalId) {
      const organizationId = store.get('workspace', workspaceId)?.organizationId ?? ''
      const approval = store.getScoped('approval', String(node.config.approvalId), { organizationId, workspaceId })
      if (!approval) throw new Error('V2 workflow approval "' + node.config.approvalId + '" does not exist in the active workspace.')
      if (approval.workspaceId !== workspaceId) throw new Error('V2 workflow cannot reference an approval from another workspace.')
    }
  }
}

export type WorkflowValidationResult = { valid: true } | { valid: false; reason: string }

export function validateWorkflowDefinition(store: V2ControlPlaneStore, workspaceId: UUID, definition: WorkflowDefinition): WorkflowValidationResult {
  try { assertDefinition(store, workspaceId, definition); return { valid: true } }
  catch (error) { return { valid: false, reason: error instanceof Error ? error.message : 'V2 workflow definition is invalid.' } }
}

export function createWorkflow(
  store: V2ControlPlaneStore,
  input: { id: UUID; organizationId: UUID; workspaceId: UUID; name: string; description?: string; definition: WorkflowDefinition },
  metadata: WorkflowMetadata,
): Workflow {
  assertDefinition(store, input.workspaceId, input.definition)
  const workflow: Workflow = { id: input.id, organizationId: input.organizationId, workspaceId: input.workspaceId, name: input.name, description: input.description, definition: input.definition, status: 'draft', createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }
  store.save('workflow', workflow)
  return workflow
}

export function updateWorkflowDefinition(
  store: V2ControlPlaneStore,
  workflowId: UUID,
  definition: WorkflowDefinition,
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Workflow {
  const workflow = store.get('workflow', workflowId)
  if (!workflow) throw new Error('V2 workflow does not exist.')
  if (definition.version <= workflow.definition.version) throw new Error('V2 workflow definition version must increase when the definition changes.')
  assertDefinition(store, workflow.workspaceId, definition)
  const updated: Workflow = { ...workflow, definition, status: 'draft', updatedAt: metadata.updatedAt }
  store.replace('workflow', updated)
  return updated
}

export function setWorkflowStatus(
  store: V2ControlPlaneStore,
  workflowId: UUID,
  status: 'draft' | 'active' | 'paused' | 'archived',
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Workflow {
  const workflow = store.get('workflow', workflowId)
  if (!workflow) throw new Error('V2 workflow does not exist.')
  if (status === 'active') assertDefinition(store, workflow.workspaceId, workflow.definition)
  const updated: Workflow = { ...workflow, status, updatedAt: metadata.updatedAt }
  store.replace('workflow', updated)
  return updated
}

export function getWorkflowDependencies(store: V2ControlPlaneStore, workflow: Workflow): { agents: Agent[]; tools: Tool[]; approvals: Approval[] } {
  const agents: Agent[] = [], tools: Tool[] = [], approvals: Approval[] = []
  for (const node of workflow.definition.nodes) {
    if (node.type === 'agent') { const item = store.get('agent', String(node.config.agentId)); if (item) agents.push(item) }
    if (node.type === 'tool') { const item = store.get('tool', String(node.config.toolId)); if (item) tools.push(item) }
    if (node.type === 'approval' && node.config.approvalId) { const item = store.get('approval', String(node.config.approvalId)); if (item) approvals.push(item) }
  }
  return { agents, tools, approvals }
}
