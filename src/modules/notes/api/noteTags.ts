import { supabase } from '@/shared/lib/supabase'
import type { Tag } from '@/shared/types/database'
import { ensureTag } from '@/modules/library/api/tags'

/** Notes and documents share the same global `tags` pool (note_tags is a join table into it, same shape as document_tags) — reuses library/api/tags.ts's ensureTag rather than a second find-or-create implementation. */
export async function addTagToNote(params: { noteId: string; tagName: string; userId: string }): Promise<Tag> {
  const tag = await ensureTag(params.tagName, params.userId)
  const { error } = await supabase.from('note_tags').insert({ note_id: params.noteId, tag_id: tag.id })
  if (error && error.code !== '23505') throw error // ignore duplicate attach
  return tag
}

export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase.from('note_tags').delete().eq('note_id', noteId).eq('tag_id', tagId)
  if (error) throw error
}

export async function listTagsForNote(noteId: string): Promise<Tag[]> {
  const { data, error } = await supabase.from('note_tags').select('tags(*)').eq('note_id', noteId)
  if (error) throw error
  return (data as unknown as { tags: Tag }[]).map((row) => row.tags)
}
