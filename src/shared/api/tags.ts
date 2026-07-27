import { supabase } from '@/shared/lib/supabase'
import type { Tag } from '@/shared/types/database'

/**
 * The `tags` table itself is shared across content types (documents, notes,
 * ...) — each module owns its own join table (document_tags, note_tags) and
 * its own attach/detach functions, but get-or-create-by-name lives here
 * once instead of being copied per module.
 */
export async function listTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function ensureTag(name: string, userId: string): Promise<Tag> {
  const trimmed = name.trim().toLowerCase()
  const { data: existing, error: selectError } = await supabase
    .from('tags')
    .select('*')
    .eq('name', trimmed)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing

  const { data, error } = await supabase
    .from('tags')
    .insert({ name: trimmed, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}
