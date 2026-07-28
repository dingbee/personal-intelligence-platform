import { supabase } from '@/shared/lib/supabase'
import type { Note } from '@/shared/types/database'

export interface NoteFilters {
  documentId?: string | null
  /** null/omitted = "All" (matches the same backward-compatible convention as documents/collections filters). */
  workspaceId?: string | null
  /** Caps result count server-side — e.g. for a "recent notes" dashboard section that doesn't need the full list. */
  limit?: number
}

export interface NoteWithDocument extends Note {
  document: { title: string } | null
}

export async function listNotes(filters: NoteFilters = {}): Promise<NoteWithDocument[]> {
  let query = supabase
    .from('notes')
    .select('*, documents(title)')
    .order('updated_at', { ascending: false })
  if (filters.documentId !== undefined) {
    query =
      filters.documentId === null
        ? query.is('document_id', null)
        : query.eq('document_id', filters.documentId)
  }
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error

  return (data as unknown as (Note & { documents: { title: string } | null })[]).map((note) => ({
    ...note,
    document: note.documents,
  }))
}

export async function getNote(id: string): Promise<Note> {
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createNote(params: {
  userId: string
  workspaceId: string | null
  title?: string
  content?: string
  documentId?: string | null
  sourceChunkIds?: string[] | null
}): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: params.userId,
      workspace_id: params.workspaceId,
      title: params.title,
      content: params.content,
      document_id: params.documentId ?? null,
      source_chunk_ids: params.sourceChunkIds ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'document_id' | 'generation_metadata'>>,
): Promise<Note> {
  const { data, error } = await supabase.from('notes').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
