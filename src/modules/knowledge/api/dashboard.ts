import { supabase } from '@/shared/lib/supabase'
import type { ChapterSummary, Highlight } from '@/shared/types/database'
import { listDocuments } from '@/modules/library/api/documents'

// highlights/chapter_summaries/flashcards have no workspace_id column of
// their own (only document_id) — scoping to the current workspace means
// joining through documents and filtering on the joined column, which
// requires an inner join (`documents!inner`) for PostgREST to let the
// filter apply. document_id is NOT NULL on all three tables, so the inner
// join never silently drops a row.

export interface HighlightWithDocument extends Highlight {
  document: { title: string } | null
}

export async function listRecentHighlights(workspaceId: string | null, limit: number): Promise<HighlightWithDocument[]> {
  let query = supabase
    .from('highlights')
    .select('*, documents!inner(title, workspace_id)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (workspaceId) query = query.eq('documents.workspace_id', workspaceId)

  const { data, error } = await query
  if (error) throw error

  return (data as unknown as (Highlight & { documents: { title: string } })[]).map((row) => ({
    ...row,
    document: row.documents,
  }))
}

export interface ChapterSummaryWithDocument extends ChapterSummary {
  document: { title: string } | null
}

export async function listRecentChapterSummaries(
  workspaceId: string | null,
  limit: number,
): Promise<ChapterSummaryWithDocument[]> {
  let query = supabase
    .from('chapter_summaries')
    .select('*, documents!inner(title, workspace_id)')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (workspaceId) query = query.eq('documents.workspace_id', workspaceId)

  const { data, error } = await query
  if (error) throw error

  return (data as unknown as (ChapterSummary & { documents: { title: string } })[]).map((row) => ({
    ...row,
    document: row.documents,
  }))
}

export interface FlashcardActivity {
  documentId: string
  documentTitle: string
  count: number
  mostRecentAt: string
}

/**
 * Groups flashcards by document with a count + most recent generation time.
 * Counts reflect the most recent `sampleLimit` cards across the workspace,
 * not a true total — fine at this app's current scale (a handful of
 * documents); a document with more than `sampleLimit` cards mixed in with
 * others' would undercount. Move to a server-side aggregate (a view or
 * RPC) if that ever becomes inaccurate in practice.
 */
export async function listFlashcardActivity(
  workspaceId: string | null,
  sampleLimit = 200,
): Promise<FlashcardActivity[]> {
  let query = supabase
    .from('flashcards')
    .select('document_id, created_at, documents!inner(title, workspace_id)')
    .order('created_at', { ascending: false })
    .limit(sampleLimit)
  if (workspaceId) query = query.eq('documents.workspace_id', workspaceId)

  const { data, error } = await query
  if (error) throw error

  const byDocument = new Map<string, FlashcardActivity>()
  for (const row of data as unknown as { document_id: string; created_at: string; documents: { title: string } }[]) {
    const existing = byDocument.get(row.document_id)
    if (existing) {
      existing.count += 1
      if (row.created_at > existing.mostRecentAt) existing.mostRecentAt = row.created_at
    } else {
      byDocument.set(row.document_id, {
        documentId: row.document_id,
        documentTitle: row.documents.title,
        count: 1,
        mostRecentAt: row.created_at,
      })
    }
  }
  return Array.from(byDocument.values()).sort((a, b) => (a.mostRecentAt < b.mostRecentAt ? 1 : -1))
}

export interface DocumentConnection {
  documentId: string
  documentTitle: string
  updatedAt: string
  noteCount: number
  highlightCount: number
}

/**
 * Recently-active documents with note/highlight counts. Three queries total
 * regardless of document count (documents, then one batched count query
 * each for notes/highlights via `.in(documentIds)`) — not N+1.
 */
export async function listDocumentConnections(workspaceId: string | null, limit = 8): Promise<DocumentConnection[]> {
  const documents = await listDocuments({ workspaceId, sort: 'newest' })
  const recent = documents.slice(0, limit)
  if (recent.length === 0) return []
  const documentIds = recent.map((document) => document.id)

  const [notesResult, highlightsResult] = await Promise.all([
    supabase.from('notes').select('document_id').in('document_id', documentIds),
    supabase.from('highlights').select('document_id').in('document_id', documentIds),
  ])
  if (notesResult.error) throw notesResult.error
  if (highlightsResult.error) throw highlightsResult.error

  const noteCounts = new Map<string, number>()
  for (const row of notesResult.data as { document_id: string }[]) {
    noteCounts.set(row.document_id, (noteCounts.get(row.document_id) ?? 0) + 1)
  }
  const highlightCounts = new Map<string, number>()
  for (const row of highlightsResult.data as { document_id: string }[]) {
    highlightCounts.set(row.document_id, (highlightCounts.get(row.document_id) ?? 0) + 1)
  }

  return recent.map((document) => ({
    documentId: document.id,
    documentTitle: document.title,
    updatedAt: document.updated_at,
    noteCount: noteCounts.get(document.id) ?? 0,
    highlightCount: highlightCounts.get(document.id) ?? 0,
  }))
}
