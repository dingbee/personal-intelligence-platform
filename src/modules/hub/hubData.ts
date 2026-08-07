import type { CommandContext } from '@/modules/commands/types'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { ConceptEvolution } from '@/modules/evolution/conceptEvolution/conceptTrend'
import type { Conversation } from '@/shared/types/database'
import { getWorkspaceEvolutionSnapshot } from '@/modules/evolution/api/evolutionData'
import { buildWorkspaceEvolutionReport, type WorkspaceEvolutionReport } from '@/modules/evolution/evolutionReport'
import { computeKnowledgeGaps, type KnowledgeGap } from '@/modules/evolution/knowledgeGaps/knowledgeGaps'
import { listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { computeConceptClusters } from '@/modules/knowledge/intelligence/conceptClusters'
import { detectGraphSignals } from '@/modules/knowledge/intelligence/graphSignals'
import { hasMemoryNeedingReview } from '@/modules/intelligence/orchestrator/signalEngine'
import { generateRecommendations, type Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'
import { listNotes, type NoteWithDocument } from '@/modules/notes/api/notes'
import { listTaggedNoteIds } from '@/modules/notes/api/noteTags'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { listLastMessageRoles } from '@/modules/ai/chat/api/messages'
import { listDocuments } from '@/modules/library/api/documents'
import { listKnowledgeCollections } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { computeWorkspaceIntelligence, type IntelligenceItem } from '@/modules/hub/workspaceIntelligence'
import { computeWorkspaceHealth, type WorkspaceHealthIndicator } from '@/modules/hub/workspaceHealth'

const RECENT_LIST_LIMIT = 5

/**
 * AI Experience Intelligence v1 — the most-recently-updated conversation
 * (among the already-fetched activeConversations, so no extra fan-out
 * beyond the one listLastMessageRoles query) whose last message role is
 * 'user'. activeConversations is already sorted pinned-first/updated_at-
 * desc by listConversations, so the first match here is genuinely the most
 * recent unresolved one.
 */
async function findUnresolvedConversation(activeConversations: Conversation[]): Promise<{ id: string; title: string } | null> {
  const lastRoles = await listLastMessageRoles(activeConversations.map((c) => c.id))
  const conversation = activeConversations.find((c) => lastRoles.get(c.id) === 'user')
  return conversation ? { id: conversation.id, title: conversation.title || 'Untitled conversation' } : null
}

export interface WorkspaceHubState {
  report: WorkspaceEvolutionReport
  activeConcepts: ConceptEvolution[]
  signals: IntelligenceSignal[]
  gaps: KnowledgeGap[]
  recommendations: Recommendation[]
  documentRelationshipCount: number
  readDocumentCount: number
  totalReadyDocumentCount: number
  recentNotes: NoteWithDocument[]
  activeConversations: Conversation[]
  intelligenceItems: IntelligenceItem[]
  health: WorkspaceHealthIndicator[]
}

/**
 * UX-13.7 — the Hub's single fetch-and-compose entry point, mirroring
 * dashboardInteraction.ts's buildDashboardState and useWorkspaceEvolution's
 * getWorkspaceEvolutionSnapshot. Deliberately reuses rather than re-fetches:
 * one snapshot fetch feeds both buildWorkspaceEvolutionReport (maturity,
 * timeline, concept evolution, health, forecasts — all UX-13) and, from the
 * same nodes/edges, detectGraphSignals (UX-10) for "AI insights" and the new
 * computeKnowledgeGaps composer for "knowledge gaps." recentNotes and
 * activeConversations (UX-13.7.3) are the one pair of fresh fetches — the
 * evolution snapshot's own notes/conversations fields are reduced shapes
 * (no id/title, just enough for timeline/activity math) and can't back a
 * "recent notes" or "active conversations" list on their own.
 *
 * UX-15.3 — notes is now an unlimited fetch (recentNotes slices it down for
 * display, same as activeConversations already did) and documents/
 * collections are now fetched too, all three reused by
 * computeWorkspaceIntelligence/computeWorkspaceHealth (Phase 2/5) alongside
 * the already-fetched snapshot.edges (every knowledge_links row for this
 * workspace, not just node-to-node ones — collection membership and note
 * references live in the same polymorphic table). This also finally closes
 * the "known simplification" the previous version of this comment
 * documented: informationOrganizationScore is now the real, computed score
 * (documents are fetched here now anyway for Phase 2's signals) instead of
 * a hardcoded 100.
 */
export async function buildWorkspaceHubState(workspaceId: string, commandContext: CommandContext): Promise<WorkspaceHubState> {
  const [snapshot, allNotes, conversations, documents, collections] = await Promise.all([
    getWorkspaceEvolutionSnapshot(workspaceId),
    listNotes({ workspaceId }),
    listConversations({ workspaceId }),
    listDocuments({ workspaceId }),
    listKnowledgeCollections({ workspaceId }),
  ])
  const report = buildWorkspaceEvolutionReport(snapshot)

  const nodeSources = await listKnowledgeNodeSourcesForNodes(snapshot.concepts.map((c) => c.id))
  const clusters = computeConceptClusters(snapshot.concepts, snapshot.edges)
  const signals = detectGraphSignals({ nodes: snapshot.concepts, edges: snapshot.edges, clusters, nodeSources })
  const gaps = computeKnowledgeGaps({ health: report.health, signals })

  const organizedDocumentCount = documents.filter((d) => d.collection_id !== null || d.tags.length > 0).length
  const informationOrganizationScore = documents.length === 0 ? 100 : Math.round((organizedDocumentCount / documents.length) * 100)

  const activeConcepts = report.concepts.filter((c) => c.status === 'emerging' || c.status === 'growing')
  const readyDocuments = snapshot.documents.filter((d) => d.status === 'ready')
  const activeConversations = conversations.slice(0, RECENT_LIST_LIMIT)

  const taggedNoteIds = await listTaggedNoteIds(allNotes.map((n) => n.id))
  const unresolvedConversation = await findUnresolvedConversation(activeConversations)

  const recommendations = generateRecommendations({
    scope: 'dashboard',
    commandContext,
    hasGraphContext: snapshot.concepts.length > 0,
    hasMemoryToReview: hasMemoryNeedingReview(snapshot.memories),
    informationOrganizationScore,
    unresolvedConversation,
  })

  const intelligenceItems = computeWorkspaceIntelligence({
    documents,
    notes: allNotes,
    knowledgeNodes: snapshot.concepts,
    edges: snapshot.edges,
    collections,
    activeConversations,
    currentUserId: commandContext.userId,
  })

  const health = computeWorkspaceHealth({
    documents,
    notes: allNotes,
    taggedNoteIds,
    knowledgeNodes: snapshot.concepts,
    edges: snapshot.edges,
    collections,
    readDocumentCount: readyDocuments.filter((d) => d.hasReadingProgress).length,
    totalReadyDocumentCount: readyDocuments.length,
  })

  return {
    report,
    activeConcepts,
    signals,
    gaps,
    recommendations,
    documentRelationshipCount: snapshot.edges.length,
    readDocumentCount: readyDocuments.filter((d) => d.hasReadingProgress).length,
    totalReadyDocumentCount: readyDocuments.length,
    recentNotes: allNotes.slice(0, RECENT_LIST_LIMIT),
    activeConversations,
    intelligenceItems,
    health,
  }
}
