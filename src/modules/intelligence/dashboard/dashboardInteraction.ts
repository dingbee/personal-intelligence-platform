import type { CommandContext } from '@/modules/commands/types'
import type { AttentionItem } from '@/modules/intelligence/orchestrator/types'
import { listDocuments } from '@/modules/library/api/documents'
import { listNotes } from '@/modules/notes/api/notes'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { listWorkspaces, getWorkspaceStats } from '@/modules/workspaces/api/workspaces'
import { listKnowledgeNodes, listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'
import { listRecentChapterSummaries, listRecentHighlights, listAllFlashcards } from '@/modules/knowledge/api/dashboard'
import { listReadingProgressForWorkspace, getMostRecentReadingProgress, getReadingProgress } from '@/modules/reader/api/readingProgress'
import { listAiRequestsSince } from '@/modules/ai/observability/api/aiRequests'
import { computeConceptClusters } from '@/modules/knowledge/intelligence/conceptClusters'
import { detectGraphSignals } from '@/modules/knowledge/intelligence/graphSignals'
import { detectAttentionItems, findContradictoryMemoryPairs } from '@/modules/intelligence/orchestrator/attentionEngine'
import { hasUnreviewedMemory } from '@/modules/intelligence/orchestrator/signalEngine'
import { computeKnowledgeGrowth, computeIntelligenceScore, type GrowthMetric, type IntelligenceScore } from '@/modules/intelligence/dashboard/dashboardMetrics'
import { generateExecutiveInsights, type ExecutiveInsight } from '@/modules/intelligence/dashboard/dashboardInsights'
import { buildAttentionCenter } from '@/modules/intelligence/dashboard/dashboardSignals'
import { generateRecommendations, type Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'
import { resolveWorkspaceIntelligenceSummaries, type WorkspaceIntelligenceSummary } from '@/modules/intelligence/dashboard/dashboardResolver'

const GROWTH_WINDOW_DAYS = 30
const RESEARCH_TOPIC_WINDOW_DAYS = 30
const HIGHLIGHT_SAMPLE_LIMIT = 200
const LINKS_SAMPLE_LIMIT = 1000

export interface DashboardState {
  scores: IntelligenceScore[]
  growth: GrowthMetric[]
  insights: ExecutiveInsight[]
  attention: AttentionItem[]
  recommendations: Recommendation[]
  workspaceSummaries: WorkspaceIntelligenceSummary[]
}

export interface BuildDashboardStateParams {
  workspaceId: string | null
  commandContext: CommandContext
}

function daysAgoIso(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * UX-11 Phase 1/2/3/5/6/7/8 — the single fetch-and-compose entry point for
 * the Executive Intelligence Dashboard, mirroring orchestrator.ts/
 * graphInteraction.ts/readerInteraction.ts. Every fetch reuses an existing
 * API function (or a trivial, read-only extension added this phase:
 * listReadingProgressForWorkspace, listAllFlashcards — both new SELECT-only
 * queries over existing tables, not schema changes); every decision is
 * delegated to a pure function in this module or an existing engine
 * (UX-8's attentionEngine, UX-10's conceptClusters/graphSignals). No AI
 * call, no new storage.
 */
export async function buildDashboardState(params: BuildDashboardStateParams): Promise<DashboardState> {
  const now = new Date()

  const [documents, notes, concepts, links, memories, conversations, chatRequests, chapterSummaries, flashcards, readingProgress, highlightSample, mostRecentReading, workspaces] =
    await Promise.all([
      listDocuments({ workspaceId: params.workspaceId }).catch(() => []),
      listNotes({ workspaceId: params.workspaceId }).catch(() => []),
      listKnowledgeNodes({ workspaceId: params.workspaceId }).catch(() => []),
      listKnowledgeLinks(params.workspaceId, LINKS_SAMPLE_LIMIT).catch(() => []),
      listMemories({ workspaceId: params.workspaceId }).catch(() => []),
      listConversations({ workspaceId: params.workspaceId }).catch(() => []),
      listAiRequestsSince(daysAgoIso(GROWTH_WINDOW_DAYS, now)).catch(() => []),
      listRecentChapterSummaries(params.workspaceId, LINKS_SAMPLE_LIMIT).catch(() => []),
      listAllFlashcards(params.workspaceId).catch(() => []),
      listReadingProgressForWorkspace(params.workspaceId).catch(() => []),
      listRecentHighlights(params.workspaceId, HIGHLIGHT_SAMPLE_LIMIT).catch(() => []),
      getMostRecentReadingProgress().catch(() => null),
      listWorkspaces().catch(() => []),
    ])

  const nodeSources = await listKnowledgeNodeSourcesForNodes(concepts.map((c) => c.id)).catch(() => [])
  const aiGeneratedLinks = links.filter((link) => Boolean(link.generated_by))

  const growth = computeKnowledgeGrowth({
    documents: documents.map((d) => ({ created_at: d.created_at })),
    notes: notes.map((n) => ({ created_at: n.created_at })),
    concepts: concepts.map((c) => ({ created_at: c.created_at })),
    connections: aiGeneratedLinks.map((l) => ({ created_at: l.created_at })),
    chatRequests: chatRequests.filter((r) => r.feature === 'chat').map((r) => ({ created_at: r.created_at })),
    insightArtifacts: [...chapterSummaries.map((c) => ({ created_at: c.updated_at })), ...flashcards],
    readingProgressUpdates: readingProgress,
    now,
  })

  const clusters = computeConceptClusters(concepts, links)
  const graphSignals = detectGraphSignals({ nodes: concepts, edges: links, clusters, nodeSources, now })
  const connectedConceptCount = clusters.reduce((sum, cluster) => sum + cluster.size, 0)
  const organizedDocumentCount = documents.filter((d) => d.collection_id !== null || d.tags.length > 0).length

  const totalMemories = memories.length
  const activeMemories = memories.filter((m) => m.is_active).length
  const contradictoryMemoryPairCount = findContradictoryMemoryPairs(memories).length

  const scores = computeIntelligenceScore({
    growth,
    totalMemories,
    activeMemories,
    contradictoryMemoryPairCount,
    connectedConceptCount,
    totalConceptCount: concepts.length,
    organizedDocumentCount,
    totalDocumentCount: documents.length,
  })
  const organizationScore = scores.find((s) => s.category === 'information_organization')?.value ?? 100

  const unreviewedHighlightCount = highlightSample.filter((h) => h.note === null).length
  const recentConversationTitles = conversations
    .filter((c) => now.getTime() - new Date(c.created_at).getTime() <= RESEARCH_TOPIC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .map((c) => c.title)
  const previousConversationTitles = conversations
    .filter((c) => {
      const age = now.getTime() - new Date(c.created_at).getTime()
      return age > RESEARCH_TOPIC_WINDOW_DAYS * 24 * 60 * 60 * 1000 && age <= RESEARCH_TOPIC_WINDOW_DAYS * 2 * 24 * 60 * 60 * 1000
    })
    .map((c) => c.title)

  const insights = generateExecutiveInsights({
    clusters,
    totalConceptCount: concepts.length,
    unreviewedHighlightCount,
    sampledHighlightCount: highlightSample.length,
    documentsWithoutCollectionCount: documents.length - organizedDocumentCount,
    totalDocumentCount: documents.length,
    memoryContents: memories.map((m) => m.content),
    recentConversationTitles,
    previousConversationTitles,
  })

  const fullProgress = mostRecentReading ? await getReadingProgress(mostRecentReading.id).catch(() => null) : null
  const inProgressDocument =
    mostRecentReading && fullProgress ? { title: mostRecentReading.title, scrollFraction: fullProgress.scroll_fraction } : null

  // Phase 8 — one summary per workspace. Reuses `links` (already fetched
  // above for the current scope) for whichever workspace matches
  // params.workspaceId, so a specific-workspace view never fetches
  // knowledge_links twice for the same workspace.
  const workspaceStatsEntries = await Promise.all(
    workspaces.map(async (workspace) => [workspace.id, await getWorkspaceStats(workspace.id).catch(() => null)] as const),
  )
  const workspaceConnectionEntries = await Promise.all(
    workspaces.map(async (workspace) => {
      const workspaceLinks =
        workspace.id === params.workspaceId ? links : await listKnowledgeLinks(workspace.id, LINKS_SAMPLE_LIMIT).catch(() => [])
      return [workspace.id, workspaceLinks.filter((link) => Boolean(link.generated_by)).length] as const
    }),
  )
  const workspaceStatsById = new Map(
    workspaceStatsEntries.filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => Boolean(entry[1])),
  )
  const workspaceSummaries = resolveWorkspaceIntelligenceSummaries({
    workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
    stats: workspaceStatsById,
    connectionCounts: new Map(workspaceConnectionEntries),
  })

  // Only meaningful for a specific workspace — "inactive workspace" isn't a
  // sensible check when viewing "All workspaces" at once, so it's null
  // (and that attention item simply never fires) rather than picking one
  // workspace arbitrarily.
  const currentWorkspaceLastActivityAt = params.workspaceId ? (workspaceStatsById.get(params.workspaceId)?.lastActivityAt ?? null) : null

  const rawAttentionItems = detectAttentionItems({
    inProgressDocument,
    memories,
    userQuery: '',
    recentConversations: [],
    workspaceLastActivityAt: currentWorkspaceLastActivityAt,
    now,
  })
  const attention = buildAttentionCenter({ attentionItems: rawAttentionItems, graphSignals })

  const recommendations = generateRecommendations({
    scope: 'dashboard',
    commandContext: params.commandContext,
    hasGraphContext: concepts.length > 0,
    hasMemoryToReview: contradictoryMemoryPairCount > 0 || hasUnreviewedMemory(memories),
    informationOrganizationScore: organizationScore,
  })

  return { scores, growth, insights, attention, recommendations, workspaceSummaries }
}
