import { supabase } from '@/shared/lib/supabase'
import type { Tag } from '@/shared/types/database'

export async function listTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').order('name', { ascending: true })
  if (error) throw error
  return data
}

async function ensureTag(name: string, userId: string): Promise<Tag> {
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

export async function addTagToDocument(params: {
  documentId: string
  tagName: string
  userId: string
}): Promise<Tag> {
  const tag = await ensureTag(params.tagName, params.userId)
  const { error } = await supabase
    .from('document_tags')
    .insert({ document_id: params.documentId, tag_id: tag.id })
  if (error && error.code !== '23505') throw error // ignore duplicate attach
  return tag
}

export async function removeTagFromDocument(documentId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('document_tags')
    .delete()
    .eq('document_id', documentId)
    .eq('tag_id', tagId)
  if (error) throw error
}

export async function renameTag(id: string, name: string): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .update({ name: name.trim().toLowerCase() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Deletes the tag entirely (cascades to remove it from every document via document_tags' FK). */
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}
