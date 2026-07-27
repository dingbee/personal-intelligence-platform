import { supabase } from '@/shared/lib/supabase'
import type { Note } from '@/shared/types/database'

export interface NoteFilters {
  workspaceId?: string | null
  collectionId?: string | null
  documentId?: string
  search?: string
}

export interface NoteWithTags extends Note {
  tags: { id: string; name: string }[]
}

export async function listNotes(filters: NoteFilters = {}): Promise<NoteWithTags[]> {
  let query = supabase
    .from('notes')
    .select('*, note_tags(tags(id, name))')
    .order('updated_at', { ascending: false })

  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.collectionId !== undefined) {
    query =
      filters.collectionId === null
        ? query.is('collection_id', null)
        : query.eq('collection_id', filters.collectionId)
  }
  if (filters.documentId) query = query.eq('document_id', filters.documentId)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error

  return (data as unknown as (Note & { note_tags: { tags: { id: string; name: string } }[] })[]).map(
    (note) => ({ ...note, tags: note.note_tags.map((nt) => nt.tags) }),
  )
}

export async function getNote(id: string): Promise<NoteWithTags> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags(tags(id, name))')
    .eq('id', id)
    .single()
  if (error) throw error
  const row = data as unknown as Note & { note_tags: { tags: { id: string; name: string } }[] }
  return { ...row, tags: row.note_tags.map((nt) => nt.tags) }
}

export async function createNote(params: {
  userId: string
  workspaceId: string | null
  collectionId?: string | null
  documentId?: string | null
  title?: string
}): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      collection_id: params.collectionId ?? null,
      document_id: params.documentId ?? null,
      title: params.title ?? 'Untitled note',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'collection_id'>>,
): Promise<Note> {
  const { data, error } = await supabase.from('notes').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
