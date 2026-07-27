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
