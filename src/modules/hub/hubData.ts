import type { CommandContext } from '@/modules/commands/types'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { ConceptEvolution } from '@/modules/evolution/conceptEvolution/conceptTrend'
import { getWorkspaceEvolutionSnapshot } from '@/modules/evolution/api/evolutionData'
import { buildWorkspaceEvolutionReport, type WorkspaceEvolutionReport } from '@/modules/evolution/evolutionReport'
import { computeKnowledgeGaps, type KnowledgeGap } from '@/modules/evolution/knowledgeGaps/knowledgeGaps'
import { listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { computeConceptClusters } from '@/modules/knowledge/intelligence/conceptClusters'
import { detectGraphSignals } from '@/modules/knowledge/intelligence/graphSignals'
import { findContradictoryMemoryPairs } from '@/modules/intelligence/orchestrator/attentionEngine'
import { hasUnreviewedMemory } from '@/modules/intelligence/orchestrator/signalEngine'
import { generateDashboardRecommendations, type DashboardRecommendation } from '@/modules/intelligence/dashboard/dashboardRecommendations'

export interface WorkspaceHubState {
  report: WorkspaceEvolutionReport
  activeConcepts: ConceptEvolution[]
  signals: IntelligenceSignal[]
  gaps: KnowledgeGap[]
  recommendations: DashboardRecommendation[]
  documentRelationshipCount: number
  readDocumentCount: number
  totalReadyDocumentCount: number
}

/**
 * UX-13.7 — the Hub's single fetch-and-compose entry point, mirroring
 * dashboardInteraction.ts's buildDashboardState and useWorkspaceEvolution's
 * getWorkspaceEvolutionSnapshot. Deliberately reuses rather than re-fetches:
 * one snapshot fetch feeds both buildWorkspaceEvolutionReport (maturity,
 * timeline, concept evolution, health, forecasts — all UX-13) and, from the
 * same nodes/edges, detectGraphSignals (UX-10) for "AI insights" and the new
 * computeKnowledgeGaps composer for "knowledge gaps."
 *
 * One known simplification: generateDashboardRecommendations's
 * informationOrganizationScore is passed as 100 (never triggers the
 * "organize your library" recommendation) rather than recomputed here — that
 * score needs full per-document tag/collection data the evolution snapshot
 * doesn't fetch, and the recommendation it gates already lives on
 * /dashboard, so duplicating that fetch here isn't worth it.
 */
export async function buildWorkspaceHubState(workspaceId: string, commandContext: CommandContext): Promise<WorkspaceHubState> {
  const snapshot = await getWorkspaceEvolutionSnapshot(workspaceId)
  const report = buildWorkspaceEvolutionReport(snapshot)

  const nodeSources = await listKnowledgeNodeSourcesForNodes(snapshot.concepts.map((c) => c.id))
  const clusters = computeConceptClusters(snapshot.concepts, snapshot.edges)
  const signals = detectGraphSignals({ nodes: snapshot.concepts, edges: snapshot.edges, clusters, nodeSources })
  const gaps = computeKnowledgeGaps({ health: report.health, signals })

  const recommendations = generateDashboardRecommendations({
    commandContext,
    hasGraphContext: snapshot.concepts.length > 0,
    hasMemoryToReview: findContradictoryMemoryPairs(snapshot.memories).length > 0 || hasUnreviewedMemory(snapshot.memories),
    informationOrganizationScore: 100,
  })

  const activeConcepts = report.concepts.filter((c) => c.status === 'emerging' || c.status === 'growing')
  const readyDocuments = snapshot.documents.filter((d) => d.status === 'ready')

  return {
    report,
    activeConcepts,
    signals,
    gaps,
    recommendations,
    documentRelationshipCount: snapshot.edges.length,
    readDocumentCount: readyDocuments.filter((d) => d.hasReadingProgress).length,
    totalReadyDocumentCount: readyDocuments.length,
  }
}
