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

/**
 * UX-11 Phase 3 — every reading_progress row for a workspace (or all
 * workspaces when null), for Knowledge Growth Analytics' "reading progress
 * updates" metric. reading_progress has no workspace_id of its own (only
 * document_id, same gap dashboard.ts already works around), so this joins
 * through documents like listRecentHighlights/listFlashcardActivity do.
 */
export async function listReadingProgressForWorkspace(workspaceId: string | null): Promise<{ updated_at: string }[]> {
  let query = supabase.from('reading_progress').select('updated_at, documents!inner(workspace_id)')
  if (workspaceId) query = query.eq('documents.workspace_id', workspaceId)
  const { data, error } = await query
  if (error) throw error
  return (data as unknown as { updated_at: string }[]).map((row) => ({ updated_at: row.updated_at }))
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
