import { supabase } from '@/shared/lib/supabase'
import type { Highlight } from '@/shared/types/database'

export async function listHighlights(documentId: string, chapterIndex?: number): Promise<Highlight[]> {
  let query = supabase
    .from('highlights')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
  if (chapterIndex !== undefined) query = query.eq('chapter_index', chapterIndex)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createHighlight(params: {
  documentId: string
  userId: string
  chapterIndex: number | null
  quote: string
  note?: string | null
}): Promise<Highlight> {
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      document_id: params.documentId,
      user_id: params.userId,
      chapter_index: params.chapterIndex,
      quote: params.quote,
      note: params.note ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHighlightNote(id: string, note: string | null): Promise<Highlight> {
  const { data, error } = await supabase.from('highlights').update({ note }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase.from('highlights').delete().eq('id', id)
  if (error) throw error
}
