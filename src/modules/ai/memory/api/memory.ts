import { supabase } from '@/shared/lib/supabase'
import type { AiMemory, AiMemoryType } from '@/shared/types/database'

export interface MemoryFilters {
  /** null/omitted = "All" (same backward-compatible convention as every other workspace filter). */
  workspaceId?: string | null
  memoryType?: AiMemoryType
  limit?: number
  /** false/omitted = active memories only (retrieveMemoryContext's scope, and the default display scope). true = also include disabled ones, for the management page. */
  includeInactive?: boolean
}

export async function listMemories(filters: MemoryFilters = {}): Promise<AiMemory[]> {
  let query = supabase.from('ai_memory').select('*').order('updated_at', { ascending: false })
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.memoryType) query = query.eq('memory_type', filters.memoryType)
  if (!filters.includeInactive) query = query.eq('is_active', true)
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createMemory(params: {
  userId: string
  workspaceId: string | null
  memoryType: AiMemoryType
  content: string
  source?: string | null
}): Promise<AiMemory> {
  const { data, error } = await supabase
    .from('ai_memory')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      memory_type: params.memoryType,
      content: params.content,
      source: params.source ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMemory(
  id: string,
  updates: Partial<Pick<AiMemory, 'content' | 'source'>>,
): Promise<AiMemory> {
  const { data, error } = await supabase.from('ai_memory').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Individual enable/disable — a reversible alternative to deleteMemory, not a duplicate of it. */
export async function setMemoryActive(id: string, isActive: boolean): Promise<AiMemory> {
  const { data, error } = await supabase
    .from('ai_memory')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Bulk enable/disable every memory of one type — "disable category" from the UX-5.3A brief. */
export async function setMemoryCategoryActive(params: {
  workspaceId: string | null
  memoryType: AiMemoryType
  isActive: boolean
}): Promise<void> {
  let query = supabase.from('ai_memory').update({ is_active: params.isActive }).eq('memory_type', params.memoryType)
  if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId)
  const { error } = await query
  if (error) throw error
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('ai_memory').delete().eq('id', id)
  if (error) throw error
}

/** "Clear all" — scoped to the current workspace filter, same null-means-All convention as everything else here. */
export async function deleteAllMemories(workspaceId: string | null): Promise<void> {
  let query = supabase.from('ai_memory').delete()
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  const { error } = await query
  if (error) throw error
}
