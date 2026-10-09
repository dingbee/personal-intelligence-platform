import { supabase } from '@/shared/lib/supabase'
import type { AutonomyLevel } from '@/modules/v2/domain/autonomy'

export type V2AgentStatus = 'draft' | 'validated' | 'active' | 'paused' | 'archived'
export type V2AgentVersionStatus = 'draft' | 'validated' | 'active' | 'retired'
export type V2AgentAutonomy = AutonomyLevel

export interface V2AgentDefinition {
  version: number
  systemPurpose: string
  capabilities: string[]
  toolIds: string[]
  memoryScopes: string[]
  policyIds: string[]
  autonomyCeiling: V2AgentAutonomy
}

export interface V2Agent {
  id: string
  ownerUserId: string
  workspaceId: string
  organizationId: string
  name: string
  slug: string
  description: string
  status: V2AgentStatus
  activeVersion: number | null
  createdAt: string
  updatedAt: string
}

export interface V2AgentVersion {
  id: string
  agentId: string
  version: number
  status: V2AgentVersionStatus
  definition: V2AgentDefinition
  createdBy: string
  createdAt: string
}

type AgentRow = Record<string, unknown>
type AgentVersionRow = Record<string, unknown>

const db = supabase as any

function requiredScopeId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Agent row is missing required ${field} scope.`)
  }
  return value
}

function mapAgent(row: AgentRow): V2Agent {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    workspaceId: requiredScopeId(row.workspace_id, 'workspace'),
    organizationId: requiredScopeId(row.organization_id, 'organization'),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ''),
    status: row.status as V2AgentStatus,
    activeVersion: row.active_version == null ? null : Number(row.active_version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapVersion(row: AgentVersionRow): V2AgentVersion {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    version: Number(row.version),
    status: row.status as V2AgentVersionStatus,
    definition: normalizeAgentDefinition(row.definition),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  }
}

export function normalizeAgentDefinition(value: unknown): V2AgentDefinition {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const autonomy = input.autonomyCeiling
  return {
    version: Number(input.version ?? 1),
    systemPurpose: typeof input.systemPurpose === 'string' ? input.systemPurpose : '',
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.filter((v): v is string => typeof v === 'string') : [],
    toolIds: Array.isArray(input.toolIds) ? input.toolIds.filter((v): v is string => typeof v === 'string') : [],
    memoryScopes: Array.isArray(input.memoryScopes) ? input.memoryScopes.filter((v): v is string => typeof v === 'string') : [],
    policyIds: Array.isArray(input.policyIds) ? input.policyIds.filter((v): v is string => typeof v === 'string') : [],
    autonomyCeiling: autonomy === 'inform' || autonomy === 'prepare' || autonomy === 'bounded' ? autonomy : 'recommend',
  }
}

export async function listV2Agents(workspaceId: string | null): Promise<V2Agent[]> {
  if (!workspaceId) return []
  const query = db.from('v2_agents').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapAgent)
}

export async function getV2AgentVersions(agentId: string): Promise<V2AgentVersion[]> {
  const { data, error } = await db
    .from('v2_agent_versions')
    .select('*')
    .eq('agent_id', agentId)
    .order('version', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapVersion)
}

export async function createV2Agent(params: {
  workspaceId: string
  name: string
  slug: string
  description?: string
}): Promise<V2Agent> {
  const { data, error } = await db.rpc('v2_create_agent', {
    p_workspace_id: params.workspaceId,
    p_name: params.name,
    p_slug: params.slug,
    p_description: params.description ?? '',
  })
  if (error) throw error
  return mapAgent(data)
}

export async function saveV2AgentVersion(
  agentId: string,
  definition: V2AgentDefinition,
): Promise<V2AgentVersion> {
  const { data, error } = await db.rpc('v2_save_agent_version', {
    p_agent_id: agentId,
    p_definition: definition,
  })
  if (error) throw error
  return mapVersion(data)
}

export async function validateV2Agent(agentId: string): Promise<V2AgentVersion> {
  const { data, error } = await db.rpc('v2_validate_agent', { p_agent_id: agentId })
  if (error) throw error
  return mapVersion(data)
}

export async function setV2AgentStatus(
  agentId: string,
  status: V2AgentStatus,
): Promise<V2Agent> {
  const { data, error } = await db.rpc('v2_set_agent_status', {
    p_agent_id: agentId,
    p_status: status,
  })
  if (error) throw error
  return mapAgent(data)
}
