import { supabase } from '@/shared/lib/supabase'
import type { Tag } from '@/shared/types/database'
import { ensureTag } from '@/shared/api/tags'

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
