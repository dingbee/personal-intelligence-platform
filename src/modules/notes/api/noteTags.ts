import { supabase } from '@/shared/lib/supabase'
import type { Tag } from '@/shared/types/database'
import { ensureTag } from '@/shared/api/tags'

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
