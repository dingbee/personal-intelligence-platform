import type { AiMemory, DocumentRow, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { computeConceptClusters } from '@/modules/knowledge/intelligence/conceptClusters'
import { buildKnowledgeTimeline, type EvolutionEvent } from '@/modules/evolution/knowledgeEvolution/knowledgeTimeline'
import { computeWorkspaceMaturity, type WorkspaceMaturity } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'
import { computeConceptEvolution, type ConceptEvolution } from '@/modules/evolution/conceptEvolution/conceptTrend'
import { computeKnowledgeHealth, type KnowledgeHealthReport } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import { computeRelationshipEvolution, type RelationshipEvolution } from '@/modules/evolution/relationshipEvolution/relationshipTrend'
import { computeWorkspaceJourney, type JourneyMilestone } from '@/modules/evolution/workspaceJourney/workspaceJourney'
import { computeKnowledgeForecasts, type Forecast } from '@/modules/evolution/knowledgeForecast/knowledgeForecast'
import { buildEvolutionTrace, type EvolutionTrace } from '@/modules/evolution/evolutionTrace/evolutionTrace'
import { daysSince } from '@/modules/evolution/shared/trend'

export interface WorkspaceEvolutionSnapshot {
  workspaceId: string
  workspaceCreatedAt: string
  documents: { id: string; title: string; created_at: string; updated_at: string; status: DocumentRow['status']; hasReadingProgress: boolean }[]
  notes: { id: string; title: string; created_at: string }[]
  concepts: KnowledgeNode[]
  edges: KnowledgeLink[]
  sourceEvents: { nodeId: string; createdAt: string }[]
  conversations: { created_at: string }[]
  memories: AiMemory[]
  readingProgressTimestamps: string[]
  lastActivityAt: string | null
  now?: Date
}

export interface WorkspaceEvolutionReport {
  maturity: WorkspaceMaturity
  timeline: EvolutionEvent[]
  concepts: ConceptEvolution[]
  health: KnowledgeHealthReport
  relationships: RelationshipEvolution
  journey: JourneyMilestone[]
  forecasts: Forecast[]
  trace: EvolutionTrace
}

function earliest(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null
  return timestamps.reduce((min, t) => (t < min ? t : min))
}

/**
 * UX-13 — the single pure composition point over one workspace's already-
 * fetched evolution data, mirroring dashboardInteraction.ts's role for the
 * Executive Dashboard: every decision is delegated to one of the eight
 * evolution modules (or UX-10's computeConceptClusters, reused not
 * recomputed); this function only assembles their inputs and outputs. Kept
 * pure (no I/O) so the whole feature's composition is unit-testable, unlike
 * dashboardInteraction.ts which had to be async because it does its own
 * fetching.
 */
export function buildWorkspaceEvolutionReport(snapshot: WorkspaceEvolutionSnapshot): WorkspaceEvolutionReport {
  const now = snapshot.now ?? new Date()
  const clusters = computeConceptClusters(snapshot.concepts, snapshot.edges)

  const activityTimestamps = [
    ...snapshot.documents.map((d) => d.created_at),
    ...snapshot.notes.map((n) => n.created_at),
    ...snapshot.concepts.map((c) => c.created_at),
    ...snapshot.edges.filter((e) => e.generated_by).map((e) => e.created_at),
    ...snapshot.conversations.map((c) => c.created_at),
  ]

  const maturity = computeWorkspaceMaturity({
    workspaceCreatedAt: snapshot.workspaceCreatedAt,
    activityTimestamps,
    lastActivityAt: snapshot.lastActivityAt,
    now,
  })

  const timeline = buildKnowledgeTimeline({
    documents: snapshot.documents,
    notes: snapshot.notes,
    concepts: snapshot.concepts,
    clusters,
    now,
  })

  const concepts = computeConceptEvolution({
    nodes: snapshot.concepts,
    edges: snapshot.edges,
    sourceEvents: snapshot.sourceEvents,
    now,
  })

  const health = computeKnowledgeHealth({
    concepts: snapshot.concepts,
    edges: snapshot.edges,
    documents: snapshot.documents,
    memories: snapshot.memories,
    workspaceLastActivityAt: snapshot.lastActivityAt,
    now,
  })

  const relationships = computeRelationshipEvolution(snapshot.edges, now)

  const journey = computeWorkspaceJourney({
    workspaceCreatedAt: snapshot.workspaceCreatedAt,
    firstDocumentAt: earliest(snapshot.documents.map((d) => d.created_at)),
    firstConceptAt: earliest(snapshot.concepts.map((c) => c.created_at)),
    firstReadingProgressAt: earliest(snapshot.readingProgressTimestamps),
    firstConversationAt: earliest(snapshot.conversations.map((c) => c.created_at)),
    currentStateLabel: maturity.label,
    now,
  })

  const forecasts = computeKnowledgeForecasts({
    maturityStage: maturity.stage,
    concepts,
    relationships,
    healthIssues: health.issues,
  })

  const recentActivityCount = activityTimestamps.filter((t) => now.getTime() - new Date(t).getTime() <= 7 * 24 * 60 * 60 * 1000).length

  const trace = buildEvolutionTrace({
    workspaceId: snapshot.workspaceId,
    inputs: {
      documentCount: snapshot.documents.length,
      noteCount: snapshot.notes.length,
      conceptCount: snapshot.concepts.length,
      connectionCount: snapshot.edges.filter((e) => e.generated_by).length,
      workspaceAgeDays: daysSince(snapshot.workspaceCreatedAt, now),
      recentActivityCount,
    },
    maturityStage: maturity.stage,
    healthScore: health.score,
    forecasts,
    now,
  })

  return { maturity, timeline, concepts, health, relationships, journey, forecasts, trace }
}
