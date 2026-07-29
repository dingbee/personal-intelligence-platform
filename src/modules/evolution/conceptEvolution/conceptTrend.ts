import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { daysSince } from '@/modules/evolution/shared/trend'

export type ConceptTrendStatus = 'emerging' | 'growing' | 'stable' | 'dormant'

export interface ConceptEvolution {
  nodeId: string
  title: string
  status: ConceptTrendStatus
  /** knowledge_node_sources rows for this node — how many documents it's been extracted from in total. */
  sourceCountTotal: number
  /** ...of which were added in the last RECENT_SOURCE_WINDOW_DAYS. */
  sourceCountRecent: number
  /** AI-generated edges touching this node. */
  degree: number
  ageDays: number
  daysSinceLastActivity: number
}

export interface ConceptSourceEvent {
  nodeId: string
  createdAt: string
}

export interface ComputeConceptEvolutionInput {
  nodes: KnowledgeNode[]
  edges: KnowledgeLink[]
  sourceEvents: ConceptSourceEvent[]
  now?: Date
}

const RECENT_SOURCE_WINDOW_DAYS = 14
const DORMANT_INACTIVITY_DAYS = 60
const EMERGING_MAX_AGE_DAYS = 14

/**
 * UX-13 — per-concept evolution status, one entry per knowledge_node. Reuses
 * the same "AI-generated edges only" convention as
 * conceptClusters/graphSignals (edge.generated_by set) and the same
 * knowledge_node_sources provenance ledger graphSignals.emerging_topic
 * already reads, just turned into a per-node classification rather than a
 * one-off signal. No new detection logic, no AI — pure counting and
 * thresholds over already-extracted data.
 */
export function computeConceptEvolution(input: ComputeConceptEvolutionInput): ConceptEvolution[] {
  const now = input.now ?? new Date()
  const { nodes, edges, sourceEvents } = input
  const nodeIds = new Set(nodes.map((n) => n.id))

  const degreeByNode = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  for (const edge of edges) {
    if (!edge.generated_by) continue
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    degreeByNode.set(edge.source_id, (degreeByNode.get(edge.source_id) ?? 0) + 1)
    degreeByNode.set(edge.target_id, (degreeByNode.get(edge.target_id) ?? 0) + 1)
  }

  return nodes.map((node) => {
    const nodeSourceEvents = sourceEvents.filter((s) => s.nodeId === node.id)
    const sourceCountTotal = nodeSourceEvents.length
    const sourceCountRecent = nodeSourceEvents.filter(
      (s) => now.getTime() - new Date(s.createdAt).getTime() <= RECENT_SOURCE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).length
    const degree = degreeByNode.get(node.id) ?? 0
    const ageDays = daysSince(node.created_at, now)
    const daysSinceLastActivity = daysSince(node.updated_at, now)

    let status: ConceptTrendStatus
    if (ageDays <= EMERGING_MAX_AGE_DAYS && sourceCountTotal <= 1) {
      status = 'emerging'
    } else if (sourceCountRecent > 0) {
      status = 'growing'
    } else if (daysSinceLastActivity >= DORMANT_INACTIVITY_DAYS) {
      status = 'dormant'
    } else {
      status = 'stable'
    }

    return { nodeId: node.id, title: node.title, status, sourceCountTotal, sourceCountRecent, degree, ageDays, daysSinceLastActivity }
  })
}
