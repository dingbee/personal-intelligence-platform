import { supabase } from '@/shared/lib/supabase'

export type V2WorkflowStatus = 'draft' | 'validated' | 'active' | 'paused' | 'archived'
export type V2WorkflowVersionStatus = 'draft' | 'validated' | 'active' | 'retired'
export type V2WorkflowNodeType = 'start' | 'understand' | 'agent' | 'tool' | 'condition' | 'approval' | 'action' | 'verify'
export type V2WorkflowTriggerType = 'manual' | 'event' | 'schedule' | 'webhook'

export interface V2WorkflowNode {
  id: string
  type: V2WorkflowNodeType
  config: Record<string, unknown>
  next: string[]
}

export interface V2WorkflowDefinition {
  version: number
  trigger: {
    type: V2WorkflowTriggerType
    config?: Record<string, unknown>
  }
  nodes: V2WorkflowNode[]
}

export interface V2Workflow {
  id: string
  ownerUserId: string
  workspaceId: string
  organizationId: string
  name: string
  slug: string
  description: string
  status: V2WorkflowStatus
  activeVersion: number | null
  createdAt: string
  updatedAt: string
}

export interface V2WorkflowVersion {
  id: string
  workflowId: string
  version: number
  status: V2WorkflowVersionStatus
  definition: V2WorkflowDefinition
  createdBy: string
  createdAt: string
}

const db = supabase as any

function mapWorkflow(row: Record<string, unknown>): V2Workflow {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    workspaceId: String(row.workspace_id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ''),
    status: row.status as V2WorkflowStatus,
    activeVersion: row.active_version == null ? null : Number(row.active_version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function normalizeDefinition(value: unknown): V2WorkflowDefinition {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const triggerInput = (input.trigger && typeof input.trigger === 'object' ? input.trigger : {}) as Record<string, unknown>
  const triggerType = triggerInput.type
  const nodes = Array.isArray(input.nodes) ? input.nodes : []
  return {
    version: Number(input.version ?? 1),
    trigger: {
      type: triggerType === 'event' || triggerType === 'schedule' || triggerType === 'webhook' ? triggerType : 'manual',
      config: triggerInput.config && typeof triggerInput.config === 'object' ? triggerInput.config as Record<string, unknown> : {},
    },
    nodes: nodes
      .filter((node): node is Record<string, unknown> => Boolean(node && typeof node === 'object'))
      .map((node) => ({
        id: String(node.id ?? ''),
        type: node.type as V2WorkflowNodeType,
        config: node.config && typeof node.config === 'object' ? node.config as Record<string, unknown> : {},
        next: Array.isArray(node.next) ? node.next.filter((value): value is string => typeof value === 'string') : [],
      })),
  }
}

function mapVersion(row: Record<string, unknown>): V2WorkflowVersion {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    version: Number(row.version),
    status: row.status as V2WorkflowVersionStatus,
    definition: normalizeDefinition(row.definition),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  }
}

export async function listV2Workflows(workspaceId: string | null): Promise<V2Workflow[]> {
  if (!workspaceId) return []
  const { data, error } = await db.from('v2_workflows').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapWorkflow)
}

export async function getV2WorkflowVersions(workflowId: string): Promise<V2WorkflowVersion[]> {
  const { data, error } = await db.from('v2_workflow_versions').select('*').eq('workflow_id', workflowId).order('version', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapVersion)
}

export async function createV2Workflow(params: {
  workspaceId: string
  name: string
  slug: string
  description?: string
}): Promise<V2Workflow> {
  const { data, error } = await db.rpc('v2_create_workflow', {
    p_workspace_id: params.workspaceId,
    p_name: params.name,
    p_slug: params.slug,
    p_description: params.description ?? '',
  })
  if (error) throw error
  return mapWorkflow(data)
}

export async function saveV2WorkflowVersion(workflowId: string, definition: V2WorkflowDefinition): Promise<V2WorkflowVersion> {
  const { data, error } = await db.rpc('v2_save_workflow_version', {
    p_workflow_id: workflowId,
    p_definition: definition,
  })
  if (error) throw error
  return mapVersion(data)
}

export async function validateV2Workflow(workflowId: string): Promise<V2WorkflowVersion> {
  const { data, error } = await db.rpc('v2_validate_workflow', { p_workflow_id: workflowId })
  if (error) throw error
  return mapVersion(data)
}

export async function setV2WorkflowStatus(workflowId: string, status: V2WorkflowStatus): Promise<V2Workflow> {
  const { data, error } = await db.rpc('v2_set_workflow_status', {
    p_workflow_id: workflowId,
    p_status: status,
  })
  if (error) throw error
  return mapWorkflow(data)
}

export function validateWorkflowDefinitionClient(definition: V2WorkflowDefinition): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  let startCount = 0

  if (!definition.trigger?.type) errors.push('Trigger type is required.')
  if (definition.nodes.length === 0) errors.push('At least one node is required.')

  for (const node of definition.nodes) {
    if (!node.id.trim()) errors.push('Every node requires an id.')
    if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`)
    ids.add(node.id)
    if (node.type === 'start') startCount += 1
    if (!Array.isArray(node.next)) errors.push(`Node ${node.id} requires next[].`)
    for (const next of node.next) {
      if (next === node.id) errors.push(`Node ${node.id} cannot point to itself.`)
      if (!definition.nodes.some((candidate) => candidate.id === next)) errors.push(`Node ${node.id} references missing node ${next}.`)
    }
    if (node.type === 'agent' && typeof node.config.agentId !== 'string') errors.push(`Agent node ${node.id} requires agentId.`)
    if (node.type === 'tool' && typeof node.config.toolId !== 'string') errors.push(`Tool node ${node.id} requires toolId.`)
    if (node.type === 'approval' && node.config.mode !== 'human' && node.config.mode !== 'policy') errors.push(`Approval node ${node.id} requires human or policy mode.`)
    if (node.type === 'condition' && typeof node.config.expression !== 'string') errors.push(`Condition node ${node.id} requires expression.`)
    if (node.type === 'action' && typeof node.config.actionId !== 'string') errors.push(`Action node ${node.id} requires actionId.`)
  }

  if (startCount !== 1) errors.push('Workflow requires exactly one start node.')

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const node = definition.nodes.find((candidate) => candidate.id === id)
    const hasCycle = node?.next.some(visit) ?? false
    visiting.delete(id)
    visited.add(id)
    return hasCycle
  }
  if (definition.nodes.some((node) => visit(node.id))) {
    errors.push('Workflow graph cannot contain cycles.')
  }

  const start = definition.nodes.find((node) => node.type === 'start')
  if (start) {
    const reachable = new Set<string>()
    const queue = [start.id]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (reachable.has(id)) continue
      reachable.add(id)
      const node = definition.nodes.find((candidate) => candidate.id === id)
      for (const next of node?.next ?? []) queue.push(next)
    }
    if (reachable.size !== definition.nodes.length) {
      errors.push('Workflow contains a node that is unreachable from start.')
    }
  }

  return errors
}
