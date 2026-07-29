import { supabase } from '@/shared/lib/supabase'
import type { Workspace } from '@/shared/types/database'

export async function listWorkspaces(options: { includeArchived?: boolean } = {}): Promise<Workspace[]> {
  let query = supabase
    .from('workspaces')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (!options.includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query
  if (error) throw error
  return data
}

/** Single-workspace name lookup for server-side contexts (e.g. the NOVA Context Engine) that only have a workspaceId, not the React WorkspaceProvider's already-loaded list. */
export async function getWorkspaceName(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('workspaces').select('name').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.name ?? null
}

/** UX-13 — the full row, for workspaceEvolution's need for `created_at` (workspace age). A single-row fetch rather than listWorkspaces() + find(), which would pull every workspace just for one's timestamp. */
export async function getWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createWorkspace(params: { name: string; userId: string }): Promise<Workspace> {
  // New workspaces go to the end of the display order — a single extra
  // round trip for the current max, cheap at this app's per-user scale.
  const { data: last, error: lastError } = await supabase
    .from('workspaces')
    .select('sort_order')
    .eq('user_id', params.userId)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (lastError) throw lastError
  const nextSortOrder = (last[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name: params.name, user_id: params.userId, sort_order: nextSortOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function archiveWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function restoreWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Deleting a workspace never deletes its content — every workspace_id FK is `on delete set null`, so documents/notes/etc. simply become unscoped (visible in "All") rather than being destroyed. */
export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) throw error
}

export interface WorkspaceHeaderSummary {
  documentCount: number
  lastActivityAt: string | null
}

/**
 * A single lightweight query, distinct from getWorkspaceStats' full
 * 8-query breakdown — this one is for the persistent header widget
 * (rendered on every page), not the management page's per-card detail.
 * Scoped to documents only (not notes/conversations too) so it stays a
 * single round trip for something visible everywhere.
 */
export async function getWorkspaceHeaderSummary(workspaceId: string | null): Promise<WorkspaceHeaderSummary> {
  let query = supabase.from('documents').select('updated_at')
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  const { data, error } = await query
  if (error) throw error
  const rows = data as { updated_at: string }[]
  return {
    documentCount: rows.length,
    lastActivityAt: latestOf(rows.map((row) => row.updated_at)),
  }
}

/** Persists a swap between two adjacent workspaces' sort_order (the result of a Move Up/Down action). */
export async function swapWorkspaceOrder(
  a: { id: string; sortOrder: number },
  b: { id: string; sortOrder: number },
): Promise<void> {
  const [aResult, bResult] = await Promise.all([
    supabase.from('workspaces').update({ sort_order: b.sortOrder }).eq('id', a.id),
    supabase.from('workspaces').update({ sort_order: a.sortOrder }).eq('id', b.id),
  ])
  if (aResult.error) throw aResult.error
  if (bResult.error) throw bResult.error
}

export interface WorkspaceStats {
  documents: number
  collections: number
  notes: number
  conversations: number
  knowledgeNodes: number
  highlights: number
  flashcards: number
  chapterSummaries: number
  storageBytes: number
  lastActivityAt: string | null
}

export function latestOf(dates: (string | null | undefined)[]): string | null {
  const present = dates.filter((d): d is string => Boolean(d))
  if (present.length === 0) return null
  return present.reduce((latest, d) => (d > latest ? d : latest))
}

/**
 * Aggregates counts across every workspace-scoped table. highlights/
 * flashcards/chapter_summaries have no workspace_id of their own (only
 * document_id — see the Knowledge Dashboard's dashboard.ts for the same
 * pattern), so those go through an inner join on documents instead.
 * All queries run in parallel; this is 8 round trips per workspace, which
 * is fine at this app's personal-use scale — move to a server-side
 * aggregate only if that stops being true.
 */
export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const [
    documentsResult,
    collectionsResult,
    notesResult,
    conversationsResult,
    knowledgeNodesResult,
    highlightsResult,
    flashcardsResult,
    chapterSummariesResult,
  ] = await Promise.all([
    supabase.from('documents').select('file_size, updated_at').eq('workspace_id', workspaceId),
    supabase.from('collections').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('notes').select('updated_at').eq('workspace_id', workspaceId),
    supabase.from('conversations').select('updated_at').eq('workspace_id', workspaceId),
    supabase.from('knowledge_nodes').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase
      .from('highlights')
      .select('id, documents!inner(workspace_id)', { count: 'exact', head: true })
      .eq('documents.workspace_id', workspaceId),
    supabase
      .from('flashcards')
      .select('id, documents!inner(workspace_id)', { count: 'exact', head: true })
      .eq('documents.workspace_id', workspaceId),
    supabase
      .from('chapter_summaries')
      .select('document_id, documents!inner(workspace_id)', { count: 'exact', head: true })
      .eq('documents.workspace_id', workspaceId),
  ])

  if (documentsResult.error) throw documentsResult.error
  if (collectionsResult.error) throw collectionsResult.error
  if (notesResult.error) throw notesResult.error
  if (conversationsResult.error) throw conversationsResult.error
  if (knowledgeNodesResult.error) throw knowledgeNodesResult.error
  if (highlightsResult.error) throw highlightsResult.error
  if (flashcardsResult.error) throw flashcardsResult.error
  if (chapterSummariesResult.error) throw chapterSummariesResult.error

  const documents = documentsResult.data as { file_size: number; updated_at: string }[]
  const notes = notesResult.data as { updated_at: string }[]
  const conversations = conversationsResult.data as { updated_at: string }[]

  return {
    documents: documents.length,
    collections: collectionsResult.count ?? 0,
    notes: notes.length,
    conversations: conversations.length,
    knowledgeNodes: knowledgeNodesResult.count ?? 0,
    highlights: highlightsResult.count ?? 0,
    flashcards: flashcardsResult.count ?? 0,
    chapterSummaries: chapterSummariesResult.count ?? 0,
    storageBytes: documents.reduce((sum, d) => sum + d.file_size, 0),
    lastActivityAt: latestOf([
      ...documents.map((d) => d.updated_at),
      ...notes.map((n) => n.updated_at),
      ...conversations.map((c) => c.updated_at),
    ]),
  }
}
