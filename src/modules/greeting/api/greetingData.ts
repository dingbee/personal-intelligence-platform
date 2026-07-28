import { supabase } from '@/shared/lib/supabase'
import { latestOf } from '@/modules/workspaces/api/workspaces'

export interface GreetingData {
  newKnowledgeConnectionsYesterday: number
  knowledgeGraphGrowthToday: number
  inProgressDocumentTitle: string | null
  daysSinceLastActivity: number | null
}

function startOfDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Account-wide (not workspace-scoped — the greeting is a holistic "your
 * knowledge" summary, not tied to whatever workspace happens to be
 * selected). "Yesterday"/"today" are calendar-day boundaries in the
 * browser's local time.
 */
export async function getGreetingData(): Promise<GreetingData> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  const [
    yesterdayNodesResult,
    yesterdayLinksResult,
    todayNodesResult,
    todayLinksResult,
    recentReadingResult,
    recentNotesResult,
    recentConversationsResult,
    recentDocumentsResult,
  ] = await Promise.all([
    supabase
      .from('knowledge_nodes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString()),
    supabase
      .from('knowledge_links')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString()),
    supabase.from('knowledge_nodes').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('knowledge_links').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase
      .from('reading_progress')
      .select('updated_at, documents(title)')
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase.from('notes').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    supabase.from('conversations').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    supabase.from('documents').select('created_at').order('created_at', { ascending: false }).limit(1),
  ])

  for (const result of [
    yesterdayNodesResult,
    yesterdayLinksResult,
    todayNodesResult,
    todayLinksResult,
    recentReadingResult,
    recentNotesResult,
    recentConversationsResult,
    recentDocumentsResult,
  ]) {
    if (result.error) throw result.error
  }

  const readingRow = (
    recentReadingResult.data as unknown as { updated_at: string; documents: { title: string } | null }[]
  )[0]

  const lastActivity = latestOf([
    readingRow?.updated_at,
    (recentNotesResult.data as { updated_at: string }[])[0]?.updated_at,
    (recentConversationsResult.data as { updated_at: string }[])[0]?.updated_at,
    (recentDocumentsResult.data as { created_at: string }[])[0]?.created_at,
  ])

  const daysSinceLastActivity = lastActivity
    ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (24 * 60 * 60 * 1000))
    : null

  return {
    newKnowledgeConnectionsYesterday: (yesterdayNodesResult.count ?? 0) + (yesterdayLinksResult.count ?? 0),
    knowledgeGraphGrowthToday: (todayNodesResult.count ?? 0) + (todayLinksResult.count ?? 0),
    inProgressDocumentTitle: readingRow?.documents?.title ?? null,
    daysSinceLastActivity,
  }
}
