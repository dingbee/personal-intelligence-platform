import { getMostRecentReadingProgress, getReadingProgress } from '@/modules/reader/api/readingProgress'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { listWorkspaces, getWorkspaceStats } from '@/modules/workspaces/api/workspaces'
import { listDocuments } from '@/modules/library/api/documents'
import { listNotes } from '@/modules/notes/api/notes'
import { isContinuationMessage } from '@/modules/intelligence/conversation/detectContinuation'
import { computeEvidenceScore } from '@/modules/intelligence/evidence/computeEvidenceScore'
import { decideContextSources } from '@/modules/intelligence/orchestrator/decisionEngine'
import { detectAttentionItems } from '@/modules/intelligence/orchestrator/attentionEngine'
import { detectOrchestratorSignals } from '@/modules/intelligence/orchestrator/signalEngine'
import { resurfaceKnowledge } from '@/modules/intelligence/orchestrator/resurfacingEngine'
import { computeWorkspaceInsights, type WorkspaceStatsSummary } from '@/modules/intelligence/orchestrator/workspaceInsightEngine'
import { generateRecommendations } from '@/modules/intelligence/recommendations/recommendationEngine'
import type { CommandContext } from '@/modules/commands/types'
import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { InteractionState } from '@/modules/intelligence/orchestrator/types'

const RECENT_LIMIT = 3
const RECENT_UPLOAD_DAYS = 7

export interface BuildInteractionStateParams {
  workspaceId: string | null
  workspaceName: string | null
  conversationTitle: string | null
  messageCount: number
  userQuery: string
  /** From useCommandContext() — a React hook, so ChatPage resolves it and passes the plain value in; orchestrator.ts itself is not a component. */
  commandContext: CommandContext
  /** Already computed by AIService this turn (UX-5.2/UX-6/UX-7) — reused, never recomputed. */
  contextTrace: ContextTrace
  references: Reference[]
  suggestions: string[]
  signals: IntelligenceSignal[]
}

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * UX-8 Phase 1/8 — "what intelligence should participate," not "what is
 * the answer." Every fetch here reuses an existing API function
 * (getMostRecentReadingProgress, listConversations, listMemories,
 * listWorkspaces/getWorkspaceStats, listDocuments, listNotes — all
 * pre-existing); every decision is delegated to a pure engine in this
 * same directory. No AI call, no new retrieval, no schema.
 */
export async function buildInteractionState(params: BuildInteractionStateParams): Promise<InteractionState> {
  const now = new Date()

  const [mostRecentReading, conversations, memories, workspaces, documents, notes] = await Promise.all([
    getMostRecentReadingProgress().catch(() => null),
    listConversations({ workspaceId: params.workspaceId }).catch(() => []),
    listMemories({ workspaceId: params.workspaceId }).catch(() => []),
    listWorkspaces().catch(() => []),
    listDocuments({ workspaceId: params.workspaceId, sort: 'newest' }).catch(() => []),
    listNotes({ workspaceId: params.workspaceId, limit: RECENT_LIMIT }).catch(() => []),
  ])

  const fullProgress = mostRecentReading ? await getReadingProgress(mostRecentReading.id).catch(() => null) : null
  const inProgressDocument =
    mostRecentReading && fullProgress
      ? { id: mostRecentReading.id, title: mostRecentReading.title, scrollFraction: fullProgress.scroll_fraction }
      : null

  const workspaceStats: WorkspaceStatsSummary[] = await Promise.all(
    workspaces.map(async (workspace) => {
      const stats = await getWorkspaceStats(workspace.id).catch(() => null)
      return {
        id: workspace.id,
        name: workspace.name,
        documentCount: stats?.documents ?? 0,
        lastActivityAt: stats?.lastActivityAt ?? null,
      }
    }),
  )

  const recentConversations = conversations.slice(0, RECENT_LIMIT).map((c) => ({ id: c.id, title: c.title }))
  const isContinuation = isContinuationMessage(params.userQuery)
  const currentWorkspaceLastActivityAt = workspaceStats.find((w) => w.id === params.workspaceId)?.lastActivityAt ?? null

  const context = decideContextSources({
    isContinuation,
    hasWorkspace: Boolean(params.workspaceName),
    hasRecentReading: Boolean(inProgressDocument),
    hasMemory: params.contextTrace.memoriesUsed > 0,
    hasGraph: params.contextTrace.graphNodes > 0,
    hasTimeline: notes.length > 0 || recentConversations.length > 0,
    hasRecentConversations: recentConversations.length > 0,
  })

  const attention = detectAttentionItems({
    inProgressDocument,
    memories,
    userQuery: params.userQuery,
    recentConversations,
    workspaceLastActivityAt: currentWorkspaceLastActivityAt,
    now,
  })

  const recentUploadsCount = documents.filter((doc) => daysSince(doc.created_at, now) <= RECENT_UPLOAD_DAYS).length

  const workspace = computeWorkspaceInsights({
    workspaces: workspaceStats,
    recentUploadsCount,
    recentConversationTitles: recentConversations.map((c) => c.title),
  })

  const resurfacedKnowledge = resurfaceKnowledge({
    inProgressDocument,
    recentNotes: notes.map((note) => ({ id: note.id, title: note.title })),
    recentConversations,
  })

  const orchestratorSignals = detectOrchestratorSignals({
    retrievedChunks: params.contextTrace.retrievedChunks,
    inProgressDocument,
    memories,
    workspaceLastActivityAt: currentWorkspaceLastActivityAt,
    conversationTitle: params.conversationTitle,
    userQuery: params.userQuery,
    messageCount: params.messageCount,
    now,
  })

  const mostActiveInsight = workspace.find((insight) => insight.type === 'most_active')
  const mostActiveWorkspace = mostActiveInsight
    ? (workspaceStats.find((w) => w.name === mostActiveInsight.value) ?? null)
    : null

  const relatedConversationItem = resurfacedKnowledge.find((item) => item.type === 'conversation') ?? null

  const actions = generateRecommendations({
    scope: 'chat',
    commandContext: params.commandContext,
    hasGraphContext: params.contextTrace.graphNodes > 0,
    relatedConversation: relatedConversationItem ? { id: relatedConversationItem.id, title: relatedConversationItem.title } : null,
    mostActiveWorkspace: mostActiveWorkspace ? { id: mostActiveWorkspace.id, name: mostActiveWorkspace.name } : null,
  })

  return {
    context,
    references: params.references,
    evidence: computeEvidenceScore({ contextTrace: params.contextTrace, isContinuation }),
    suggestions: params.suggestions,
    actions,
    attention,
    resurfacedKnowledge,
    workspace,
    signals: [...params.signals, ...orchestratorSignals],
  }
}
