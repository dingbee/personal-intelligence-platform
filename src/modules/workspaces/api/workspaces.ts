import { supabase } from '@/shared/lib/supabase'
import type { Workspace } from '@/shared/types/database'

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase.from('workspaces').select('*').order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createWorkspace(params: { name: string; userId: string }): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name: params.name, user_id: params.userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) throw error
}
