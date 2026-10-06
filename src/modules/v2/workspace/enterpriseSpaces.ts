import { supabase } from '@/shared/lib/supabase'
import type { WorkspaceMemberRole } from '@/shared/types/database'
import type { SpaceDescriptor } from './space'

export interface V2BusinessSpaceRow {
  id: string
  user_id: string
  name: string
  v2_kind: 'business' | null
  v2_status: 'active' | 'paused' | 'archived' | null
  v2_subscription: 'enterprise' | null
  v2_organization_id: string | null
  v2_pause_reason: 'manual' | 'entitlement' | null
  archived_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function asBusinessRows(data: unknown): V2BusinessSpaceRow[] {
  return (Array.isArray(data) ? data : []).filter(
    (row): row is V2BusinessSpaceRow =>
      Boolean(row && typeof row === 'object' && (row as V2BusinessSpaceRow).v2_kind === 'business'),
  )
}

export async function listArriyiaV2Spaces(userId: string): Promise<SpaceDescriptor[]> {
  const [workspacesResult, membershipsResult] = await Promise.all([
    supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  if (workspacesResult.error) throw workspacesResult.error
  if (membershipsResult.error) throw membershipsResult.error

  const roles = new Map(
    (membershipsResult.data ?? []).map((row) => [row.workspace_id, row.role as WorkspaceMemberRole]),
  )

  return asBusinessRows(workspacesResult.data).map((workspace) => ({
    id: workspace.id,
    kind: 'business',
    name: workspace.name,
    subscription: 'enterprise',
    status: workspace.v2_status ?? 'active',
    ownerUserId: workspace.user_id,
    organizationId: workspace.v2_organization_id ?? workspace.id,
    membershipRole: roles.get(workspace.id) ?? null,
  }))
}

export async function createArriyiaBusinessSpace(
  userId: string,
  name: string,
): Promise<SpaceDescriptor> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Business Space name is required.')

  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: userId,
      name: trimmedName,
      v2_kind: 'business',
      v2_status: 'active',
      v2_subscription: 'enterprise',
      v2_organization_id: crypto.randomUUID(),
    } as never)
    .select('*')
    .single()

  if (error) throw error

  const workspace = data as unknown as V2BusinessSpaceRow
  return {
    id: workspace.id,
    kind: 'business',
    name: workspace.name,
    subscription: 'enterprise',
    status: workspace.v2_status ?? 'active',
    ownerUserId: workspace.user_id,
    organizationId: workspace.v2_organization_id ?? workspace.id,
    membershipRole: 'owner',
  }
}

export async function pauseArriyiaBusinessSpace(spaceId: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ v2_status: 'paused' } as never)
    .eq('id', spaceId)
    .eq('v2_kind', 'business' as never)

  if (error) throw error
}

export async function resumeArriyiaBusinessSpace(spaceId: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ v2_status: 'active' } as never)
    .eq('id', spaceId)
    .eq('v2_kind', 'business' as never)

  if (error) throw error
}

export async function archiveArriyiaBusinessSpace(spaceId: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ v2_status: 'archived', archived_at: new Date().toISOString() } as never)
    .eq('id', spaceId)
    .eq('v2_kind', 'business' as never)

  if (error) throw error
}
