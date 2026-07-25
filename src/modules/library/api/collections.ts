import { supabase } from '@/shared/lib/supabase'
import type { Collection } from '@/shared/types/database'

export async function listCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createCollection(params: {
  name: string
  parentId: string | null
  userId: string
}): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({ name: params.name, parent_id: params.parentId, user_id: params.userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameCollection(id: string, name: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw error
}
