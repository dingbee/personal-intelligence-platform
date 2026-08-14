import { supabase } from '@/shared/lib/supabase'
import type { WorkspaceObjective, WorkspaceObjectiveStatus } from '@/shared/types/database'

export async function listWorkspaceObjectives(workspaceId: string): Promise<WorkspaceObjective[]> {
  const { data, error } = await supabase
    .from('workspace_objectives')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Single-row fetch — used by Execution Foundation's executeCapability.ts to load the real objective a link_action_to_workspace_objective request names, so it can call linkActionToWorkspaceObjective's own existing hook rather than duplicating its logic. RLS scopes this to the caller's own objectives exactly like every other query here. */
export async function getWorkspaceObjective(id: string): Promise<WorkspaceObjective> {
  const { data, error } = await supabase.from('workspace_objectives').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createWorkspaceObjective(params: {
  userId: string
  workspaceId: string
  content: string
}): Promise<WorkspaceObjective> {
  const { data, error } = await supabase
    .from('workspace_objectives')
    .insert({ user_id: params.userId, workspace_id: params.workspaceId, content: params.content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setWorkspaceObjectiveStatus(
  id: string,
  status: WorkspaceObjectiveStatus,
): Promise<WorkspaceObjective> {
  const { data, error } = await supabase
    .from('workspace_objectives')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWorkspaceObjective(id: string): Promise<void> {
  const { error } = await supabase.from('workspace_objectives').delete().eq('id', id)
  if (error) throw error
}

/** Generic content update — used by Action Intelligence's "Link action to existing objective" hook (see action-intelligence/api/linkActionToWorkspaceObjective.ts) to append a reference onto an objective already loaded by the caller, without adding a dedicated linking table. */
export async function updateWorkspaceObjectiveContent(id: string, content: string): Promise<WorkspaceObjective> {
  const { data, error } = await supabase.from('workspace_objectives').update({ content }).eq('id', id).select().single()
  if (error) throw error
  return data
}
