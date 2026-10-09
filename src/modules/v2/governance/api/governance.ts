import { supabase } from '@/shared/lib/supabase'

export type GovernanceStatus = 'draft' | 'active' | 'paused' | 'archived'
export type GovernanceAutonomy = 'inform' | 'recommend' | 'prepare' | 'bounded'
export type GovernanceApprovalMode = 'never' | 'consequential' | 'always'

export interface V2GovernancePolicy {
  id: string; ownerUserId: string; workspaceId: string; organizationId: string
  name: string; slug: string; description: string; status: GovernanceStatus
  autonomyCeiling: GovernanceAutonomy; approvalMode: GovernanceApprovalMode
  allowedToolScopes: string[]; updatedAt: string
}
type Row = Record<string, unknown>
const db = supabase as any

function mapPolicy(row: Row): V2GovernancePolicy {
  return {
    id: String(row.id), ownerUserId: String(row.owner_user_id), workspaceId: String(row.workspace_id),
    organizationId: String(row.organization_id), name: String(row.name), slug: String(row.slug),
    description: String(row.description ?? ''), status: row.status as GovernanceStatus,
    autonomyCeiling: row.autonomy_ceiling as GovernanceAutonomy, approvalMode: row.approval_mode as GovernanceApprovalMode,
    allowedToolScopes: Array.isArray(row.allowed_tool_scopes) ? row.allowed_tool_scopes.filter((v): v is string => typeof v === 'string') : [],
    updatedAt: String(row.updated_at),
  }
}
export async function listGovernancePolicies(workspaceId: string | null) {
  if (!workspaceId) return []
  const { data, error } = await db.from('v2_governance_policies').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPolicy)
}
export async function createGovernancePolicy(p: {workspaceId:string;name:string;slug:string;description?:string}) {
  const { data, error } = await db.rpc('v2_create_governance_policy', {p_workspace_id:p.workspaceId,p_name:p.name,p_slug:p.slug,p_description:p.description ?? ''})
  if (error) throw error
  return mapPolicy(data)
}
export async function updateGovernancePolicy(id:string,a:GovernanceAutonomy,m:GovernanceApprovalMode,tools:string[]) {
  const { data, error } = await db.rpc('v2_update_governance_policy',{p_policy_id:id,p_autonomy_ceiling:a,p_approval_mode:m,p_allowed_tool_scopes:tools})
  if (error) throw error
  return mapPolicy(data)
}
export async function setGovernancePolicyStatus(id:string,status:GovernanceStatus) {
  const { data, error } = await db.rpc('v2_set_governance_policy_status',{p_policy_id:id,p_status:status})
  if (error) throw error
  return mapPolicy(data)
}
