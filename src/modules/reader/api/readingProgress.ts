import { supabase } from '@/shared/lib/supabase'
import type { ReadingProgress } from '@/shared/types/database'

export async function getReadingProgress(documentId: string): Promise<ReadingProgress | null> {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('document_id', documentId)
    .maybeSingle()
  if (error) throw error
  return data
}

export interface InProgressDocument {
  id: string
  title: string
  updatedAt: string
}

/**
 * The single most recently updated reading_progress row, joined for the
 * document's title — "what was I in the middle of." Shared by the
 * greeting engine ("Continue reading X?") and the Command Bar's
 * "Continue reading" command, so there's exactly one query for this, not
 * two copies that could drift.
 */
export async function getMostRecentReadingProgress(): Promise<InProgressDocument | null> {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('updated_at, documents(id, title)')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) throw error

  const row = (data as unknown as { updated_at: string; documents: { id: string; title: string } | null }[])[0]
  if (!row?.documents) return null
  return { id: row.documents.id, title: row.documents.title, updatedAt: row.updated_at }
}

export async function saveReadingProgress(params: {
  documentId: string
  userId: string
  chapterIndex: number
  scrollFraction: number
}): Promise<void> {
  const { error } = await supabase.from('reading_progress').upsert(
    {
      document_id: params.documentId,
      user_id: params.userId,
      chapter_index: params.chapterIndex,
      scroll_fraction: params.scrollFraction,
    },
    { onConflict: 'document_id,user_id' },
  )
  if (error) throw error
}
