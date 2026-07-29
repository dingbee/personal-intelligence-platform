import { supabase } from '@/shared/lib/supabase'
import type { ChapterSummary } from '@/shared/types/database'

export async function getChapterSummary(documentId: string, chapterIndex: number): Promise<ChapterSummary | null> {
  const { data, error } = await supabase
    .from('chapter_summaries')
    .select('*')
    .eq('document_id', documentId)
    .eq('chapter_index', chapterIndex)
    .maybeSingle()
  if (error) throw error
  return data
}

/** UX-9 — every summary for a document (not just one chapter), for documentJourney/readingInsights' "recently summarized" without a per-chapter round trip each. */
export async function listChapterSummaries(documentId: string): Promise<ChapterSummary[]> {
  const { data, error } = await supabase
    .from('chapter_summaries')
    .select('*')
    .eq('document_id', documentId)
    .order('chapter_index', { ascending: true })
  if (error) throw error
  return data
}

export async function saveChapterSummary(params: {
  documentId: string
  userId: string
  chapterIndex: number
  content: string
  model: string
}): Promise<ChapterSummary> {
  const { data, error } = await supabase
    .from('chapter_summaries')
    .upsert(
      {
        document_id: params.documentId,
        user_id: params.userId,
        chapter_index: params.chapterIndex,
        content: params.content,
        model: params.model,
      },
      { onConflict: 'document_id,chapter_index' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}
