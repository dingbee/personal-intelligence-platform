import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'
import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'

const RECENT_GROWTH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const RAPID_GROWTH_MIN_NODES = 3
const HIGH_CONFIDENCE_THRESHOLD = 0.8
const WEAK_EVIDENCE_THRESHOLD = 0.4
const CONCEPT_DRIFT_MIN_GAP_MS = 24 * 60 * 60 * 1000
const DUPLICATE_TITLE_JACCARD_THRESHOLD = 0.6

export interface DetectGraphSignalsInput {
  nodes: KnowledgeNode[]
  edges: KnowledgeLink[]
  clusters: Cluster[]
  nodeSources: KnowledgeNodeSourceRef[]
  now?: Date
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function hasDirectEdge(nodeAId: string, nodeBId: string, edges: KnowledgeLink[]): boolean {
  return edges.some(
    (edge) =>
      Boolean(edge.generated_by) &&
      ((edge.source_id === nodeAId && edge.target_id === nodeBId) ||
        (edge.source_id === nodeBId && edge.target_id === nodeAId)),
  )
}

/**
 * UX-10 Phase 6 — extends the existing signal engine with graph-derived
 * signals. Purely informational (see signals/types.ts's UX-6 note): nothing
 * here triggers a notification, background job, or auto-created object.
 * Every check is deterministic graph/text analysis — duplicate_concept uses
 * Jaccard similarity over normalized-title word sets, not AI classification
 * or embeddings.
 */
export function detectGraphSignals(input: DetectGraphSignalsInput): IntelligenceSignal[] {
  const { nodes, edges, clusters, nodeSources } = input
  const now = input.now ?? new Date()
  if (nodes.length === 0) return []

  const signals: IntelligenceSignal[] = []

  const degrees = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!edge.generated_by) continue
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    degrees.set(edge.source_id, (degrees.get(edge.source_id) ?? 0) + 1)
    degrees.set(edge.target_id, (degrees.get(edge.target_id) ?? 0) + 1)
  }

  const disconnected = nodes.find((n) => (degrees.get(n.id) ?? 0) === 0)
  if (disconnected) {
    signals.push({ type: 'disconnected_concept', message: `"${disconnected.title}" has no known connections yet.` })
  }

  if (clusters.length > 1) {
    const smallest = clusters[clusters.length - 1]!
    signals.push({
      type: 'knowledge_island',
      message: `"${smallest.label}" forms an isolated knowledge island of ${smallest.size} concepts, disconnected from the rest of your graph.`,
    })
  }

  const recentlyGrown = nodes.filter((node) => {
    const sourceCount = nodeSources.filter((s) => s.nodeId === node.id && s.sourceType === 'document').length
    const isRecent = now.getTime() - new Date(node.updated_at).getTime() <= RECENT_GROWTH_WINDOW_MS
    return isRecent && sourceCount > 1
  })
  if (recentlyGrown.length > 0) {
    const winner = [...recentlyGrown].sort(
      (a, b) =>
        nodeSources.filter((s) => s.nodeId === b.id).length - nodeSources.filter((s) => s.nodeId === a.id).length,
    )[0]!
    signals.push({ type: 'emerging_topic', message: `"${winner.title}" is gaining new sources quickly.` })
  }

  if (recentlyGrown.length >= RAPID_GROWTH_MIN_NODES) {
    signals.push({
      type: 'rapid_growth',
      message: `${recentlyGrown.length} concepts have grown new sources in the last two weeks.`,
    })
  }

  for (const cluster of clusters) {
    const internalEdges = edges.filter(
      (edge) =>
        Boolean(edge.generated_by) &&
        cluster.nodeIds.includes(edge.source_id) &&
        cluster.nodeIds.includes(edge.target_id) &&
        edge.confidence !== null,
    )
    if (internalEdges.length === 0) continue
    const avgConfidence = internalEdges.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / internalEdges.length
    if (avgConfidence >= HIGH_CONFIDENCE_THRESHOLD) {
      signals.push({
        type: 'high_confidence_cluster',
        message: `"${cluster.label}" is a high-confidence cluster (${Math.round(avgConfidence * 100)}% average confidence).`,
      })
      break
    }
  }

  const weakEdge = edges.find(
    (edge) => Boolean(edge.generated_by) && edge.confidence !== null && edge.confidence < WEAK_EVIDENCE_THRESHOLD,
  )
  if (weakEdge) {
    signals.push({
      type: 'weak_evidence',
      message: `A relationship in your graph has low confidence (${Math.round((weakEdge.confidence ?? 0) * 100)}%) — worth reviewing.`,
    })
  }

  const drifted = nodes.find(
    (node) => new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() >= CONCEPT_DRIFT_MIN_GAP_MS,
  )
  if (drifted) {
    signals.push({ type: 'concept_drift', message: `"${drifted.title}" has evolved since it was first extracted.` })
  }

  outer: for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!
      const b = nodes[j]!
      if (a.node_type !== b.node_type) continue
      if (hasDirectEdge(a.id, b.id, edges)) continue
      const similarity = jaccard(new Set(normalizeTitle(a.title).split(' ')), new Set(normalizeTitle(b.title).split(' ')))
      if (similarity >= DUPLICATE_TITLE_JACCARD_THRESHOLD && similarity < 1) {
        signals.push({ type: 'duplicate_concept', message: `"${a.title}" and "${b.title}" may be duplicate concepts.` })
        break outer
      }
    }
  }

  return signals
}
