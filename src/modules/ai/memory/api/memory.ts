import { supabase } from '@/shared/lib/supabase'
import type { AiMemory, AiMemoryType } from '@/shared/types/database'

export interface MemoryFilters {
  /** null/omitted = "All" (same backward-compatible convention as every other workspace filter). */
  workspaceId?: string | null
  memoryType?: AiMemoryType
  limit?: number
}

export async function listMemories(filters: MemoryFilters = {}): Promise<AiMemory[]> {
  let query = supabase.from('ai_memory').select('*').order('updated_at', { ascending: false })
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.memoryType) query = query.eq('memory_type', filters.memoryType)
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

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('ai_memory').delete().eq('id', id)
  if (error) throw error
}
